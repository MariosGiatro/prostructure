import http.server
import socketserver
import urllib.request
import json
import os
import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter, maximum_filter
from collections import deque

PORT = int(os.environ.get("PORT", "8000"))

# ─────────────────────────────────────────────────────────────────────────────
#  Pure-Python geometric cavity detection  (numpy + scipy only)
#  Algorithm:
#    1. Parse heavy atom coords from downloaded PDB file
#    2. Build an occupancy grid (atom VdW + probe radius)
#    3. Flood-fill from all 6 box faces to mark the exterior
#    4. Remaining enclosed voids = cavities
#    5. BFS-cluster voids → individual pockets
#    6. For each pocket: compute volume, center, lining residues within 5 Å
# ─────────────────────────────────────────────────────────────────────────────

def _make_occupied(coords, radii, mins, D, gs):
    """Fast occupancy grid using EDT per unique radius group."""
    idxs = np.clip(np.floor((coords - mins) / gs).astype(int), 0, np.array(D) - 1)
    unique_r = np.unique(np.round(radii, 2))
    occupied = np.zeros(D, dtype=bool)
    for r in unique_r:
        atom_mask = np.zeros(D, dtype=bool)
        for i in np.where(np.abs(radii - r) < 0.02)[0]:
            atom_mask[idxs[i, 0], idxs[i, 1], idxs[i, 2]] = True
        edt = distance_transform_edt(~atom_mask) * gs
        occupied |= (edt <= r)
    return occupied


def _flood_exterior(occ):
    """BFS flood-fill from all 6 box faces through free (non-occupied) voxels."""
    D = occ.shape
    D6 = [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    reach = np.zeros(D, dtype=bool)
    q = deque()

    def seed(x, y, z):
        if (0 <= x < D[0] and 0 <= y < D[1] and 0 <= z < D[2]
                and not occ[x, y, z] and not reach[x, y, z]):
            reach[x, y, z] = True
            q.append((x, y, z))

    for i in range(D[0]):
        for j in range(D[1]):
            seed(i, j, 0);        seed(i, j, D[2] - 1)
    for i in range(D[0]):
        for k in range(D[2]):
            seed(i, 0, k);        seed(i, D[1] - 1, k)
    for j in range(D[1]):
        for k in range(D[2]):
            seed(0, j, k);        seed(D[0] - 1, j, k)

    while q:
        x, y, z = q.popleft()
        for dx, dy, dz in D6:
            seed(x + dx, y + dy, z + dz)
    return reach


def find_cavities(atoms, gs=1.0, small_probe=1.4, large_probe=4.5, min_vol=50.0, chain_id=None):
    """
    Two-probe pocket detection using scipy.
      - Small probe (1.4 Å) can reach surface clefts and active-site pockets.
      - Large probe (4.5 Å) cannot enter pockets — its excluded volume is bigger.
      - Pocket space = reachable by small probe AND NOT reachable by large probe.
    Pocket voxels are split into sub-pockets via Voronoi seeding from depth maxima.
    Returns list of dicts: {volume, depth, center, residues}.
    """
    SKIP = {'HOH', 'WAT', 'H2O'}
    heavy = [a for a in atoms
             if a['name'][0] not in ('H', 'D') and a['resname'] not in SKIP]
    
    if chain_id:
        heavy = [a for a in heavy if a['chain'].upper() == chain_id.upper()]

    if not heavy:
        return []

    coords = np.array([[a['x'], a['y'], a['z']] for a in heavy], dtype=np.float32)
    VDW = {'C': 1.70, 'N': 1.55, 'O': 1.52, 'S': 1.80, 'P': 1.80,
           'F': 1.47, 'ZN': 1.39, 'FE': 1.25, 'MG': 1.73}

    pad  = 8.0
    mins = coords.min(axis=0) - pad
    dims = np.minimum(
        np.ceil((coords.max(axis=0) - mins + pad) / gs).astype(int) + 1, 200)
    D = tuple(dims.tolist())

    sr = np.array([VDW.get(a['name'][0].upper(), 1.70) + small_probe for a in heavy], dtype=np.float32)
    lr = np.array([VDW.get(a['name'][0].upper(), 1.70) + large_probe for a in heavy], dtype=np.float32)

    occ_s   = _make_occupied(coords, sr, mins, D, gs)
    occ_l   = _make_occupied(coords, lr, mins, D, gs)
    reach_s = _flood_exterior(occ_s)
    reach_l = _flood_exterior(occ_l)

    pocket_mask = reach_s & ~reach_l
    if not pocket_mask.any():
        return []

    # Depth within pocket space: distance to nearest non-pocket voxel
    depth = distance_transform_edt(pocket_mask) * gs

    # Local depth maxima → pocket seeds (8 Å neighbourhood)
    nbhd   = max(3, int(8.0 / gs))
    smooth = gaussian_filter(depth.astype(float), sigma=2.0)
    lmax   = maximum_filter(smooth, size=nbhd * 2 + 1)
    seeds  = np.argwhere((smooth == lmax) & pocket_mask & (depth > 1.0))
    seeds  = seeds[np.argsort([depth[s[0], s[1], s[2]] for s in seeds])[::-1]]

    if len(seeds) == 0:
        return []

    # Voronoi-like assignment: BFS from seedd, expand through pocket space
    seed_arr   = seeds[:15]
    assigned   = np.full(D, -1, dtype=np.int16)
    dist_grid  = np.full(D, np.inf)
    D6         = [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    import heapq
    heap = []

    for si, seed in enumerate(seed_arr):
        x, y, z = int(seed[0]), int(seed[1]), int(seed[2])
        assigned[x, y, z]  = si
        dist_grid[x, y, z] = 0
        heapq.heappush(heap, (0.0, x, y, z, si))

    while heap:
        d, x, y, z, si = heapq.heappop(heap)
        if dist_grid[x, y, z] < d:
            continue
        for dx, dy, dz in D6:
            nx, ny, nz = x + dx, y + dy, z + dz
            if (0 <= nx < D[0] and 0 <= ny < D[1] and 0 <= nz < D[2]
                    and pocket_mask[nx, ny, nz]):
                nd = d + 1.0
                if nd < dist_grid[nx, ny, nz]:
                    dist_grid[nx, ny, nz] = nd
                    assigned[nx, ny, nz]  = si
                    heapq.heappush(heap, (nd, nx, ny, nz, si))

    # Collect pocket data for each seed region
    vox_vol = gs ** 3
    pockets = []
    for si in range(len(seed_arr)):
        mask  = (assigned == si)
        count = int(mask.sum())
        if count == 0:
            continue
        vol = float(count) * vox_vol
        if vol < min_vol:
            continue

        voxels = np.argwhere(mask)
        center = voxels.mean(axis=0) * gs + mins
        max_d  = float(depth[mask].max())

        # Convert pocket voxels to real-space coordinates
        pocket_coords = voxels * gs + mins  # Nx3 array

        # Find lining residues: any ATOM residue within 4.5 Å of a pocket voxel
        # This is much more accurate than distance-from-center
        LINING_CUTOFF = 4.5
        lining = {}
        
        # Filter to only standard residues (not HETATM)
        std_atoms = [a for a in atoms if not a['hetatm'] and a['resname'] not in SKIP]
        if chain_id:
            std_atoms = [a for a in std_atoms if a['chain'].upper() == chain_id.upper()]
        
        if len(pocket_coords) > 0 and len(std_atoms) > 0:
            atom_coords = np.array([[a['x'], a['y'], a['z']] for a in std_atoms], dtype=np.float32)
            
            # For efficiency, first filter by bounding box
            pocket_min = pocket_coords.min(axis=0) - LINING_CUTOFF
            pocket_max = pocket_coords.max(axis=0) + LINING_CUTOFF
            bbox_mask = np.all((atom_coords >= pocket_min) & (atom_coords <= pocket_max), axis=1)
            
            for ai in np.where(bbox_mask)[0]:
                a = std_atoms[ai]
                ac = atom_coords[ai]
                # Min distance from this atom to any pocket voxel
                dists = np.sqrt(np.sum((pocket_coords - ac)**2, axis=1))
                min_dist = float(dists.min())
                if min_dist <= LINING_CUTOFF:
                    key = (a['chain'], a['resseq'])
                    if key not in lining or min_dist < lining[key][1]:
                        lining[key] = (a['resname'], min_dist)

        pockets.append({
            'volume':   round(vol, 1),
            'depth':    round(max_d, 2),
            'center':   [round(float(center[i]), 2) for i in range(3)],
            'residues': [
                {'chain': ch, 'resseq': rs, 'resname': rn, 'dist': round(d, 1)}
                for (ch, rs), (rn, d) in sorted(lining.items())
            ],
        })

    pockets.sort(key=lambda p: p['volume'], reverse=True)
    return pockets[:10]


def parse_pdb_atoms(pdb_text):
    atoms = []
    for line in pdb_text.splitlines():
        if not (line.startswith('ATOM') or line.startswith('HETATM')):
            continue
        try:
            rec     = line[:6].strip()
            name    = line[12:16].strip()
            resname = line[17:20].strip()
            chain   = line[21].strip()
            resseq  = int(line[22:26])
            x       = float(line[30:38])
            y       = float(line[38:46])
            z       = float(line[46:54])
            atoms.append({'name': name, 'resname': resname,
                          'chain': chain, 'resseq': resseq,
                          'x': x, 'y': y, 'z': z,
                          'hetatm': rec == 'HETATM'})
        except (ValueError, IndexError):
            continue
    return atoms


# ───────────────────────────────────────────────
#  Simulation Integration
# ───────────────────────────────────────────────
SIM_WORKSPACE = os.path.join(os.getcwd(), 'simulations_data')
os.makedirs(SIM_WORKSPACE, exist_ok=True)

def prepare_simulation_job(pdb_id, receptor_chain, ligand_id, is_protein_ligand):
    """
    Prepares a directory for a GROMACS simulation.
    - pdb_id: the structure ID
    - receptor_chain: chain ID for receptor
    - ligand_id: chain ID (if protein) or ligand name (if small mol)
    - is_protein_ligand: bool, true if ligand is a protein chain
    """
    import shutil
    job_id = f"sim_{pdb_id}_{receptor_chain}_{ligand_id}_{os.urandom(2).hex()}"
    job_dir = os.path.join(SIM_WORKSPACE, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    # 1. Download and trim PDB
    try:
        req = urllib.request.Request(f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb")
        pdb_text = urllib.request.urlopen(req).read().decode('utf-8')
        
        # Simple trimmer: Keep only selected chains/ligands and rename to A and B
        lines = pdb_text.splitlines()
        trimmed_lines = []
        for line in lines:
            if line.startswith(('ATOM', 'HETATM')):
                chain = line[21].strip()
                resname = line[17:20].strip()
                if chain == receptor_chain:
                    # Rename receptor to Chain A
                    new_line = line[:21] + 'A' + line[22:]
                    trimmed_lines.append(new_line)
                elif is_protein_ligand and chain == ligand_id:
                    # Rename protein ligand to Chain B
                    new_line = line[:21] + 'B' + line[22:]
                    trimmed_lines.append(new_line)
                elif not is_protein_ligand and resname == ligand_id:
                    # Rename small mol to Chain B
                    new_line = line[:21] + 'B' + line[22:]
                    trimmed_lines.append(new_line)
        
        with open(os.path.join(job_dir, f"{pdb_id}_trimmed.pdb"), 'w') as f:
            f.write('\n'.join(trimmed_lines))
            
        # 2. Copy the appropriate script
        script_name = 'gmxAutopilotGPU0_dimer.sh' if is_protein_ligand else 'gmxAutopilotGPU0_smallmol.sh'
        src_script = os.path.join('C:\\Users\\miatr\\Desktop\\integrate', script_name)
        if os.path.exists(src_script):
            shutil.copy(src_script, os.path.join(job_dir, 'run_sim.sh'))
        
        # 3. Create placeholder for status
        with open(os.path.join(job_dir, 'status.json'), 'w') as f:
            json.dump({'status': 'queued', 'job_id': job_id, 'pdb_id': pdb_id}, f)
            
        return job_id
    except Exception as e:
        print(f"Simulation prep failed: {e}")
        return None


class ProStructureHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/uniprot/'):
            self.proxy_request(f"https://rest.uniprot.org/uniprotkb/{self.path.split('/')[-1]}?format=json")
        elif self.path.startswith('/api/pdb/entry/'):
            self.proxy_request(f"https://data.rcsb.org/rest/v1/core/entry/{self.path.split('/')[-1]}")
        elif self.path.startswith('/api/alphafold/'):
            self.proxy_request(f"https://alphafold.ebi.ac.uk/api/prediction/{self.path.split('/')[-1]}")
        elif self.path.startswith('/api/chembl/target/'):
            self.proxy_request(f"https://www.ebi.ac.uk/chembl/api/data/target.json?target_components__accession={self.path.split('/')[-1]}")
        elif self.path.startswith('/api/chembl/mechanisms/'):
            self.proxy_request(f"https://www.ebi.ac.uk/chembl/api/data/mechanism.json?target_chembl_id={self.path.split('/')[-1]}")
        elif self.path.startswith('/api/chembl/activities/'):
            self.proxy_request(f"https://www.ebi.ac.uk/chembl/api/data/activity.json?target_chembl_id={self.path.split('/')[-1]}&limit=100")
        elif self.path.startswith('/api/pdb/ligands/'):
            self.proxy_request(f"https://data.rcsb.org/rest/v1/core/entry/{self.path.split('/')[-1]}")
        elif self.path.startswith('/api/pdb/bound_molecules/'):
            self.proxy_request(f"https://www.ebi.ac.uk/pdbe/graph-api/pdb/bound_molecules/{self.path.split('/')[-1]}")
        elif self.path.startswith('/api/pdb/nonpoly_entity/'):
            parts = self.path.split('/')
            self.proxy_request(f"https://data.rcsb.org/rest/v1/core/nonpolymer_entity/{parts[-2]}/{parts[-1]}")
        elif self.path.startswith('/api/pdb/polymer/'):
            pdb_id, entity_id = self.path.split('/')[-1].split('_')
            self.proxy_request(f"https://data.rcsb.org/rest/v1/core/polymer_entity/{pdb_id}/{entity_id}")
        elif self.path.startswith('/api/pdb/features/'):
            pdb_id, entity_id = self.path.split('/')[-1].split('_')
            self.proxy_request(f"https://data.rcsb.org/rest/v1/core/polymer_entity_feature/{pdb_id}/{entity_id}")
        elif self.path == '/api/local/simulations':
            if os.path.exists('enriched_results.csv'):
                with open('enriched_results.csv', 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/csv')
                    self.end_headers()
                    self.wfile.write(f.read())
            else:
                self.send_response(404); self.end_headers()
        elif self.path.startswith('/api/cavity_search/'):
            parts = self.path.split('/')
            pdb_id = parts[3].lower()
            chain_id = parts[4].upper() if len(parts) > 4 else None
            self.handle_cavity_search(pdb_id, chain_id)
        elif self.path.startswith('/api/boltz/run'):
            # Usage: /api/boltz/run?accession=P12345&partner_seq=...&partner_type=protein
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query)
            accession = query.get('accession', [None])[0]
            partner = query.get('partner', [None])[0]
            p_type = query.get('type', ['protein'])[0]
            
            if accession and partner:
                job_id = self.prepare_boltz_job(accession, partner, p_type)
                self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps({'job_id': job_id}).encode())
            else:
                self.send_response(400); self.end_headers()
        elif self.path.startswith('/api/simulations/run'):
            # Usage: /api/simulations/run?pdb=1abc&receptor=A&ligand=B&type=protein
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query)
            pdb_id = query.get('pdb', [None])[0]
            receptor = query.get('receptor', [None])[0]
            ligand = query.get('ligand', [None])[0]
            is_protein = query.get('type', ['protein'])[0] == 'protein'
            
            if pdb_id and receptor and ligand:
                job_id = prepare_simulation_job(pdb_id, receptor, ligand, is_protein)
                self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps({'job_id': job_id}).encode())
            else:
                self.send_response(400); self.end_headers()
        elif self.path.startswith('/api/docking/run'):
            # Usage: /api/docking/run?pdb=1abc&receptor=A&ligand=XYZ
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query)
            pdb_id = query.get('pdb', [None])[0]
            receptor = query.get('receptor', [None])[0]
            ligand = query.get('ligand', [None])[0]
            
            if pdb_id and receptor and ligand:
                job_id = self.prepare_docking_job(pdb_id, receptor, ligand)
                self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps({'job_id': job_id}).encode())
            else:
                self.send_response(400); self.end_headers()
        elif self.path == '/api/simulations/list':
            jobs = []
            if os.path.exists(SIM_WORKSPACE):
                for d in os.listdir(SIM_WORKSPACE):
                    status_file = os.path.join(SIM_WORKSPACE, d, 'status.json')
                    if os.path.exists(status_file):
                        with open(status_file, 'r') as f:
                            jobs.append(json.load(f))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(jobs).encode())
        else:
            super().do_GET()

    def handle_cavity_search(self, pdb_id, chain_id=None):
        try:
            req = urllib.request.Request(
                f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb",
                headers={'User-Agent': 'ProStructure/1.0'})
            pdb_text = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', errors='replace')
            atoms    = parse_pdb_atoms(pdb_text)
            cavities = find_cavities(atoms, chain_id=chain_id)
            result   = {'pdb_id': pdb_id.upper(), 'chain_id': chain_id, 'cavities': cavities, 'count': len(cavities)}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def prepare_boltz_job(self, accession, partner, p_type):
        job_id = f"boltz_{accession}_{os.urandom(2).hex()}"
        job_dir = os.path.join(SIM_WORKSPACE, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        # 1. Generate Boltz2 YAML
        # We need the sequence from UniProt (mocking it for now if not passed, but app.js will pass it)
        # Assuming partner is SMILES for small_molecule or sequence for protein
        yaml_content = {
            "version": 1,
            "job_name": job_id,
            "sequences": [
                {"protein": {"id": "target", "sequence": "REPLACE_WITH_ACTUAL_SEQ"}}
            ]
        }
        if p_type == 'protein':
            yaml_content["sequences"].append({"protein": {"id": "binder", "sequence": partner}})
        else:
            yaml_content["sequences"].append({"ligand": {"id": "small_mol", "smiles": partner}})
            
        with open(os.path.join(job_dir, 'boltz_config.yaml'), 'w') as f:
            json.dump(yaml_content, f, indent=2) # Using JSON as easy YAML proxy for now
            
        with open(os.path.join(job_dir, 'status.json'), 'w') as f:
            json.dump({'status': 'prepared', 'job_id': job_id, 'type': 'boltz', 'command': f'boltz predict boltz_config.yaml'}, f)
        
        return job_id

    def prepare_docking_job(self, pdb_id, receptor, ligand):
        job_id = f"dock_{pdb_id}_{os.urandom(2).hex()}"
        job_dir = os.path.join(SIM_WORKSPACE, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        with open(os.path.join(job_dir, 'status.json'), 'w') as f:
            json.dump({'status': 'prepared', 'job_id': job_id, 'type': 'docking', 'command': f'gnina -r receptor.pdb -l ligand.sdf --autobox_ligand receptor.pdb'}, f)
            
        return job_id

    def do_POST(self):
        if self.path == '/api/foldseek/search':
            content_length = int(self.headers['Content-Length'])
            self.rfile.read(content_length)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"message": "Job submitted (Mock)"}).encode())
        else:
            self.send_error(404)

    def proxy_request(self, url):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'ProStructure/1.0'})
            with urllib.request.urlopen(req) as r:
                data = r.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

    def end_headers(self):
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
        super().end_headers()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), ProStructureHandler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()
