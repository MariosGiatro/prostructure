// ───────────────────────────────────────────────
//  UI references
// ───────────────────────────────────────────────
const UI = {
    input:         document.getElementById('proteinInput'),
    searchBtn:     document.getElementById('searchBtn'),
    hero:          document.getElementById('hero-section'),
    results:       document.getElementById('results-section'),
    seqResults:    document.getElementById('sequence-results'),
    proteinTitle:  document.getElementById('proteinTitle'),
    geneName:      document.getElementById('geneName'),
    organismName:  document.getElementById('organismName'),
    seqLength:     document.getElementById('seqLength'),
    featureList:   document.getElementById('featureList'),
    tabContent:    document.getElementById('tabContent'),
    tabs:          document.querySelectorAll('.tab-btn'),
    structureSource: document.getElementById('structureSource'),
    plddtLegend:   document.getElementById('plddt-legend'),
    colorScheme:   document.getElementById('colorScheme'),
    plddtNote:     document.getElementById('plddt-only-note'),
};

// ───────────────────────────────────────────────
//  State
// ───────────────────────────────────────────────
let currentData      = null;
let chemblData       = { mechanisms: [], activities: [] };
let expandedPdb      = null;
let isAlphaFold      = false;   // track whether current structure is AF
let currentAccession = null;    // UniProt accession of shown structure
let viewerPlugin     = null;    // PDBeMolstarPlugin instance
let structureChains  = [];      // List of chains in the current structure
let hiddenChains     = new Set(); // Set of hidden chain IDs
let entityMetadata   = {};      // Map of PDB Entity ID -> { gene, accession, name }

// ───────────────────────────────────────────────
//  Consistent Protein Colors
// ───────────────────────────────────────────────
const GENE_COLOR_MAP = {
    'PO5F1': '#ff4d4d', // Oct4 - Vibrant Coral
    'OCT4':  '#ff4d4d',
    'PO5F1_HUMAN': '#ff4d4d',
    'SOX2':  '#4ade80', // SOX2 - Mint Green
    'NANOG': '#60a5fa', // NANOG - Sky Blue
    'KLF4':  '#fbbf24', // KLF4 - Amber
    'MYC':   '#a78bfa', // MYC - Lavender
    'SRC':   '#f472b6', // SRC - Pink
    'TP53':  '#fb7185', // P53 - Rose
    'EGFR':  '#38bdf8', // EGFR - Light Blue
    'KRAS':  '#fb923c', // KRAS - Orange
    'BRCA1': '#c084fc', // BRCA1 - Purple
    'BRCA2': '#818cf8', // BRCA2 - Indigo
    'ESR1':  '#f472b6', // Estrogen Receptor - Pink
};

// The target protein of interest always gets this unmistakable color
const TARGET_PROTEIN_COLOR = '#ff4d4d'; // Vibrant Coral – reserved for the query protein

// Large palette of maximally-separated colors for other protein chains
// Ordered so consecutive picks are visually distinct from each other
const PROTEIN_CHAIN_COLORS = [
    '#4ade80', // Mint Green
    '#a78bfa', // Lavender
    '#fb923c', // Orange
    '#f472b6', // Pink
    '#fbbf24', // Amber
    '#38bdf8', // Sky Blue
    '#e879f9', // Fuchsia
    '#34d399', // Emerald
    '#c084fc', // Purple
    '#f97316', // Deep Orange
    '#22d3ee', // Cyan
    '#facc15', // Yellow
    '#818cf8', // Indigo
    '#fb7185', // Rose
    '#a3e635', // Lime
    '#2dd4bf', // Teal
    '#d946ef', // Magenta
    '#fdba74', // Peach
    '#67e8f9', // Light Cyan
    '#bef264', // Yellow-Green
];

// DNA / RNA chains get their own cool-toned palette so they never clash with proteins
const NUCLEIC_ACID_COLORS = [
    '#94a3b8', // Slate (muted – nucleic acids are usually "support")
    '#64748b', // Dark Slate
    '#78716c', // Warm Gray
    '#a1a1aa', // Zinc
    '#6b7280', // Cool Gray
    '#57534e', // Stone
    '#9ca3af', // Gray-400
    '#71717a', // Zinc-500
];

// ───────────────────────────────────────────────
//  Helpers
// ───────────────────────────────────────────────
const isSequence = (str) =>
    /^[ARNDCEQGHILKMFPSTWYV\s]+$/i.test(str.trim()) && str.trim().length > 20;

// ───────────────────────────────────────────────
//  Viewer  (PDBeMolstarPlugin JS API)
// ───────────────────────────────────────────────

/**
 * Create a fresh PDBeMolstarPlugin instance with the given options.
 * Destroys any existing viewer first to avoid double-init issues.
 */
const createViewer = (options) => new Promise((resolve, reject) => {
    if (typeof PDBeMolstarPlugin === 'undefined') {
        reject(new Error('PDBeMolstarPlugin library not loaded.'));
        return;
    }

    const el = document.getElementById('molstar-viewer');
    if (!el) { reject(new Error('molstar-viewer element not found')); return; }

    // Destroy previous instance cleanly
    if (viewerPlugin) {
        try { viewerPlugin.plugin?.dispose?.(); } catch (_) {}
        viewerPlugin = null;
    }
    el.innerHTML = '';

    viewerPlugin = new PDBeMolstarPlugin();

    const mergedOpts = {
        pdbeLink: false,
        bgColor: { r: 15, g: 23, b: 42 },
        landscape: true,
        hideControls: true,
        hideStructure: ['water'],
        ...options
    };

    viewerPlugin.render(el, mergedOpts);

    // Wait until visual API is available
    let attempts = 0;
    const ready = () => {
        attempts++;
        if (viewerPlugin && viewerPlugin.visual && typeof viewerPlugin.visual.update === 'function') {
            resolve(viewerPlugin);
        } else if (attempts > 60) {
            reject(new Error('Molstar viewer failed to initialize in time'));
        } else {
            setTimeout(ready, 200);
        }
    };
    ready();
});

/** Load a PDB structure by 4-letter ID */
const loadPDBStructure = async (pdbId) => {
    try {
        await createViewer({
            moleculeId: pdbId.toLowerCase(),
            assemblyId: '1'
        });
        // Allow the structure to fully render
        await new Promise(r => setTimeout(r, 800));
        applyColorTheme();
    } catch (e) {
        console.error('loadPDBStructure failed:', e);
        showViewerError('Failed to load PDB structure. Try refreshing.');
    }
};

const showViewerError = (msg) => {
    const el = document.getElementById('molstar-viewer');
    if (el) {
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#ff4d4d;text-align:center;padding:2rem;background:#0f172a;border-radius:12px;">
            <div style="font-size:2rem;margin-bottom:1rem;">⚠️</div>
            <div>${msg}</div>
            <button onclick="location.reload()" class="pdb-btn-expand" style="margin-top:1rem;">Reload Dashboard</button>
        </div>`;
    }
}

/** Load an AlphaFold structure by UniProt accession */
const loadAlphaFoldStructure = async (accession) => {
    const url = `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v4.cif`;
    try {
        await createViewer({
            customData: { url, format: 'mmcif' },
            superpose: false,
            alphafoldView: true
        });
        await new Promise(r => setTimeout(r, 800));
        applyColorTheme();
    } catch (e) {
        console.error('loadAlphaFoldStructure failed:', e);
        showViewerError('Failed to load AlphaFold structure.');
    }
};

/** Apply the selected color theme */
const applyColorTheme = () => {
    if (!viewerPlugin || !viewerPlugin.visual) return;
    const selected = UI.colorScheme.value;

    if (selected === 'protein-name') {
        applyProteinNameColors();
        return;
    }

    // For non-custom themes, reset any selections and let the viewer
    // use its default rendering. Color themes like chain-id, element-symbol
    // etc. are baked into the viewer via reset.
    try {
        viewerPlugin.visual.clearSelection();
        viewerPlugin.visual.reset({ theme: true, camera: false });
    } catch (e) {
        console.warn('applyColorTheme failed:', e);
    }
};

/**
 * Deterministic hash (FNV-1a) so the same gene name always maps to the same
 * palette index, regardless of how many chains exist or their order.
 */
const fnv1aHash = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0; // unsigned 32-bit
};

/**
 * Pick a deterministic color from a palette for a given key string.
 * If the chosen slot is already taken, walk forward until a free one is found.
 */
const deterministicColor = (key, palette, usedColors) => {
    const base = fnv1aHash(key) % palette.length;
    for (let i = 0; i < palette.length; i++) {
        const color = palette[(base + i) % palette.length];
        if (!usedColors.has(color)) {
            usedColors.add(color);
            return color;
        }
    }
    // All slots used — just return the hashed one (unavoidable repeat)
    return palette[base];
};

/**
 * Check whether a chain belongs to the protein of interest.
 * Uses multiple heuristics: UniProt accession match (most reliable),
 * gene name matching with normalization, and curated map lookup.
 */
const isChainTarget = (ch, targetGene, targetAcc) => {
    // 1. Accession match — most reliable across PDB entries
    if (ch.accession && targetAcc && ch.accession.toUpperCase() === targetAcc) {
        return true;
    }

    const geneUp    = (ch.gene || '').toUpperCase();
    const geneFirst = geneUp.split(' ')[0];

    // 2. Exact gene name match
    if (targetGene && (geneUp === targetGene || geneFirst === targetGene)) {
        return true;
    }

    // 3. Curated map explicitly maps this gene to the target color
    if (GENE_COLOR_MAP[geneUp] === TARGET_PROTEIN_COLOR ||
        GENE_COLOR_MAP[geneFirst] === TARGET_PROTEIN_COLOR) {
        return true;
    }

    // 4. Fuzzy: strip trailing digits/underscores and compare
    //    e.g. "POU5F1" vs "PO5F1", "OCT4" vs "OCT4_HUMAN"
    const normalize = s => s.replace(/[_\-\s]/g, '').replace(/\d+$/, '');
    if (targetGene && normalize(geneFirst) === normalize(targetGene)) {
        return true;
    }

    return false;
};

const applyProteinNameColors = () => {
    if (!viewerPlugin) return;
    
    const selectData = [];
    const legendEntries = [];        // {name, color, type} for the legend
    const usedColors = new Set();    // track assigned hex values to avoid dupes
    
    // Identify the target gene/accession (what the user searched for)
    const targetGene = (UI.geneName.innerText || '').toUpperCase();
    const targetAcc  = (currentAccession || '').toUpperCase();
    
    if (isAlphaFold && currentAccession) {
        // AlphaFold: single chain, always the target
        const gene = UI.geneName.innerText || 'Target';
        selectData.push({
            struct_asym_id: 'A',
            color: hexToRgb(TARGET_PROTEIN_COLOR)
        });
        usedColors.add(TARGET_PROTEIN_COLOR);
        legendEntries.push({ name: gene, color: TARGET_PROTEIN_COLOR, type: 'target' });
    } else {
        // Group chains by unique gene name to give same-gene chains the same color
        const geneColorAssignments = {};  // gene -> hex
        
        // Reserve the target color so no other chain can claim it
        usedColors.add(TARGET_PROTEIN_COLOR);
        
        // First pass: identify target chains and assign them the reserved color
        structureChains.forEach(ch => {
            const geneUp = (ch.gene || '').toUpperCase();
            if (!geneColorAssignments[geneUp] && isChainTarget(ch, targetGene, targetAcc)) {
                geneColorAssignments[geneUp] = TARGET_PROTEIN_COLOR;
            }
        });
        
        // Second pass: assign deterministic colors to all remaining chains
        structureChains.forEach(ch => {
            const geneUp = (ch.gene || '').toUpperCase();
            const isNucleic = ch.entityType && (
                ch.entityType.includes('ribonucleotide') ||
                ch.entityType.includes('deoxyribonucleotide') ||
                ch.entityType.toLowerCase().includes('dna') ||
                ch.entityType.toLowerCase().includes('rna')
            );
            
            let colorHex;
            
            // Already assigned (target chain, or same gene as a previously-seen chain)
            if (geneColorAssignments[geneUp]) {
                colorHex = geneColorAssignments[geneUp];
            }
            // Known gene from the curated map (but never steal the target color)
            else if (GENE_COLOR_MAP[geneUp] && GENE_COLOR_MAP[geneUp] !== TARGET_PROTEIN_COLOR) {
                colorHex = GENE_COLOR_MAP[geneUp];
                usedColors.add(colorHex);
            }
            else if (GENE_COLOR_MAP[geneUp.split(' ')[0]] && GENE_COLOR_MAP[geneUp.split(' ')[0]] !== TARGET_PROTEIN_COLOR) {
                colorHex = GENE_COLOR_MAP[geneUp.split(' ')[0]];
                usedColors.add(colorHex);
            }
            // Nucleic acid → deterministic pick from cool-toned palette
            else if (isNucleic) {
                colorHex = deterministicColor(geneUp, NUCLEIC_ACID_COLORS, usedColors);
            }
            // Other protein → deterministic pick from vibrant palette
            else {
                colorHex = deterministicColor(geneUp, PROTEIN_CHAIN_COLORS, usedColors);
            }
            
            geneColorAssignments[geneUp] = colorHex;
            
            selectData.push({
                auth_asym_id: ch.id,
                color: hexToRgb(colorHex)
            });
            
            // Build legend (one entry per unique gene)
            if (!legendEntries.find(e => e.name === ch.gene && e.color === colorHex)) {
                const typeLabel = isNucleic ? 'nucleic' : 
                    (colorHex === TARGET_PROTEIN_COLOR ? 'target' : 'protein');
                legendEntries.push({ name: ch.gene, color: colorHex, type: typeLabel });
            }
        });
    }

    try {
        viewerPlugin.visual.select({
            data: selectData,
            nonSelectedColor: { r: 50, g: 50, b: 60 }
        });
        renderProteinLegend(legendEntries);
    } catch (e) {
        console.warn('Protein name coloring failed', e);
    }
};

const renderProteinLegend = (entries) => {
    let legend = document.getElementById('protein-legend');
    if (!legend) {
        legend = document.createElement('div');
        legend.id = 'protein-legend';
        legend.className = 'viewer-legend';
        UI.plddtLegend.parentNode.appendChild(legend);
    }
    
    UI.plddtLegend.classList.add('hidden');
    legend.classList.remove('hidden');
    
    // Sort: target first, then other proteins, then nucleic acids
    const order = { target: 0, protein: 1, nucleic: 2 };
    const sorted = [...entries].sort((a, b) => (order[a.type] ?? 1) - (order[b.type] ?? 1));
    
    legend.innerHTML = sorted.map(e => {
        const label = e.type === 'target' ? `<strong>${e.name}</strong> ★` :
                      e.type === 'nucleic' ? `${e.name} <span style="opacity:0.6;font-size:0.7rem">(nucleic acid)</span>` :
                      e.name;
        return `<div class="legend-item"><span class="color" style="background:${e.color}"></span> ${label}</div>`;
    }).join('');
};

// ───────────────────────────────────────────────
//  Structure loading orchestration
// ───────────────────────────────────────────────
const loadStructure = async (accession) => {
    currentAccession = accession;
    hiddenChains.clear();
    const pdbEntries = currentData.uniProtKBCrossReferences?.filter(r => r.database === 'PDB') || [];

    if (pdbEntries.length > 0) {
        isAlphaFold = false;
        const pdbId = pdbEntries[0].id;
        UI.structureSource.innerText = `PDB: ${pdbId}`;
        UI.plddtLegend.classList.add('hidden');
        UI.plddtNote.classList.remove('hidden');   // warn: pLDDT n/a for PDB
        await loadPDBStructure(pdbId);
        await fetchFullEntityMetadata(pdbId);
    } else {
        isAlphaFold = true;
        UI.structureSource.innerText = 'AlphaFold (Predicted)';
        UI.plddtLegend.classList.remove('hidden');
        UI.plddtNote.classList.add('hidden');
        // Default to pLDDT for AF
        UI.colorScheme.value = 'plddt';
        
        // For AF, manually set the single chain metadata
        structureChains = [{ id: 'A', gene: UI.geneName.innerText || 'Target', entityId: '1' }];
        
        await loadAlphaFoldStructure(accession);
    }
    
    // Auto-apply protein-name scheme if we find a gene of interest
    const hasInterest = isAlphaFold ? 
        (GENE_COLOR_MAP[UI.geneName.innerText?.toUpperCase()] || GENE_COLOR_MAP[currentAccession?.toUpperCase()]) :
        structureChains.some(ch => GENE_COLOR_MAP[ch.gene.toUpperCase()] || GENE_COLOR_MAP[ch.gene.split(' ')[0].toUpperCase()]);
    
    if (hasInterest) {
        UI.colorScheme.value = 'protein-name';
        applyColorTheme();
    }
};

/** Fetch metadata for all polymer entities to map chains to genes/names */
const fetchFullEntityMetadata = async (pdbId) => {
    try {
        const res = await fetch(`/api/pdb/ligands/${pdbId}`);
        const entry = await res.json();
        const polymerIds = entry.rcsb_entry_container_identifiers.polymer_entity_ids || [];
        
        entityMetadata = {};
        structureChains = [];

        await Promise.all(polymerIds.map(async eid => {
            const r = await fetch(`/api/pdb/polymer/${pdbId}_${eid}`);
            if (!r.ok) return;
            const d = await r.json();
            
            const gene = d.rcsb_entity_source_organism?.[0]?.rcsb_gene_name?.[0]?.value || 
                         d.rcsb_polymer_entity?.pdbx_description || `Entity ${eid}`;
            const accession = d.rcsb_polymer_entity_align?.[0]?.reference_database_accession;
            const chains = d.entity_poly.pdbx_strand_id.split(',');
            // entity_poly.type tells us protein vs DNA vs RNA
            const entityType = d.entity_poly?.type || 'polypeptide(L)';

            entityMetadata[eid] = { gene, accession, chains, entityType };
            chains.forEach(ch => {
                structureChains.push({ id: ch.trim(), gene, entityId: eid, entityType, accession });
            });
        }));

        // Sort chains alphabetically
        structureChains.sort((a, b) => a.id.localeCompare(b.id));
        
        // Re-render pockets to update chain selector if on that tab
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'pockets') renderPockets();
        
    } catch (e) {
        console.error('Failed to fetch entity metadata', e);
    }
};

const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 200, g: 200, b: 200 };
};

/** Toggle visibility of a chain using select API (dims hidden chains) */
window.toggleChainVisibility = (chainId, visible) => {
    if (!viewerPlugin || !viewerPlugin.visual) return;
    if (visible) hiddenChains.delete(chainId);
    else hiddenChains.add(chainId);

    // Re-apply coloring: show visible chains normally, hide others
    try {
        const visibleChains = structureChains.filter(ch => !hiddenChains.has(ch.id));
        if (visibleChains.length === structureChains.length) {
            // All visible → clear selection to show defaults
            viewerPlugin.visual.clearSelection();
            return;
        }
        // Color visible chains; dim hidden ones
        const data = visibleChains.map(ch => ({
            auth_asym_id: ch.id,
            color: { r: 180, g: 180, b: 200 }, // neutral visible
        }));
        viewerPlugin.visual.select({
            data: data,
            nonSelectedColor: { r: 15, g: 23, b: 42 }, // match background = effectively hidden
        });
    } catch (e) {
        console.warn('toggleChainVisibility failed', e);
    }
};

// ───────────────────────────────────────────────
//  Color-scheme dropdown handler
// ───────────────────────────────────────────────
UI.colorScheme.addEventListener('change', () => {
    const isPlddtSelected = UI.colorScheme.value === 'plddt';
    UI.plddtNote.classList.toggle('hidden', !isPlddtSelected || isAlphaFold);
    applyColorTheme();
});

// ───────────────────────────────────────────────
//  UniProt data fetching
// ───────────────────────────────────────────────
const fetchProteinData = async (query) => {
    try {
        const res = await fetch(`/api/uniprot/${query}`);
        if (!res.ok) throw new Error('Protein not found. Check the UniProt ID and try again.');
        const data = await res.json();
        currentData = data;

        displayMetadata(data);
        await Promise.all([
            loadStructure(data.primaryAccession),
            fetchChEMBLData(data.primaryAccession)
        ]);

        UI.hero.classList.add('hidden');
        UI.results.classList.remove('hidden');
        UI.seqResults.classList.add('hidden');
    } catch (err) {
        alert(err.message);
    }
};

const fetchChEMBLData = async (accession) => {
    try {
        const res = await fetch(`/api/chembl/target/${accession}`);
        const data = await res.json();
        const tid = data.targets?.[0]?.target_chembl_id;
        if (!tid) return;

        const [mechRes, actRes] = await Promise.all([
            fetch(`/api/chembl/mechanisms/${tid}`),
            fetch(`/api/chembl/activities/${tid}`)
        ]);

        const mechs = await mechRes.json();
        const acts  = await actRes.json();
        chemblData.mechanisms = mechs.mechanisms || [];
        chemblData.activities = acts.activities  || [];
    } catch (e) { console.error('ChEMBL Error', e); }
};

const fetchPDBEntry = async (pdbId) => {
    try {
        const res = await fetch(`/api/pdb/ligands/${pdbId}`);
        return await res.json();
    } catch (e) { console.error('PDB Entry Error', e); return null; }
};

// ───────────────────────────────────────────────
//  Metadata display
// ───────────────────────────────────────────────
const displayMetadata = (data) => {
    UI.proteinTitle.innerText = data.proteinDescription.recommendedName.fullName.value;
    UI.geneName.innerText     = data.genes?.[0]?.geneName?.value || 'N/A';
    UI.organismName.innerText = data.organism.commonName || data.organism.scientificName;
    UI.seqLength.innerText    = data.sequence.length;

    UI.featureList.innerHTML = '';
    const features = data.features || [];
    features.slice(0, 15).forEach(f => {
        const tag = document.createElement('span');
        tag.className = 'feature-tag';
        tag.innerText = `${f.type}: ${f.description || f.location.start.value}-${f.location.end.value}`;
        UI.featureList.appendChild(tag);
    });

    updateTabs('ligands');
};

// ───────────────────────────────────────────────
//  Tabs
// ───────────────────────────────────────────────
const updateTabs = (tab) => {
    UI.tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    UI.tabContent.innerHTML = '';
    if (tab === 'ligands')      renderLigands();
    else if (tab === 'solved')      renderSolvedStructures();
    else if (tab === 'chains')      renderChains();
    else if (tab === 'cofactors')   renderCofactors();
    else if (tab === 'variants')    renderVariants();
    else if (tab === 'isoforms')    renderIsoforms();
    else if (tab === 'pockets')     renderPockets();
    else if (tab === 'simulations') renderSimulations();
    else if (tab === 'design')      window.renderDesign();
};

/** Isoforms tab */
const renderIsoforms = () => {
    const isoforms = currentData?.comments?.filter(c => c.commentType === 'ALTERNATIVE PRODUCTS') || [];
    if (isoforms.length === 0) {
        UI.tabContent.innerHTML = '<p>No isoform information available for this protein.</p>';
        return;
    }
    const container = document.createElement('div');
    container.className = 'variant-list';
    isoforms.forEach(iso => {
        const events = iso.isoforms || [];
        events.forEach(isoform => {
            const item = document.createElement('div');
            item.className = 'variant-item';
            const seqIds = isoform.isoformSequenceStatus === 'Described'
                ? isoform.isoformIds?.join(', ') || 'N/A'
                : 'Not described';
            item.innerHTML = `
                <div>
                    <div class="variant-label">${isoform.name?.value || 'Isoform'}</div>
                    <div class="text-sub">IDs: ${seqIds}</div>
                </div>
                <span class="pathogenicity path-uncertain">${isoform.isoformSequenceStatus || 'Unknown'}</span>
            `;
            container.appendChild(item);
        });
    });
    if (container.innerHTML === '') {
        container.innerHTML = '<p>No detailed isoform data found.</p>';
    }
    UI.tabContent.appendChild(container);
};

// ───────────────────────────────────────────────
//  Tab renderers
// ───────────────────────────────────────────────
const renderLigands = () => {
    const container = document.createElement('div');
    container.className = 'ligand-list';

    if (chemblData.mechanisms.length > 0) {
        container.innerHTML += `<h4 class="section-title">Validated Binders (Drugs)</h4>`;
        chemblData.mechanisms.slice(0, 5).forEach(m => {
            container.innerHTML += `<div class="ligand-item drug"><span>${m.molecule_chembl_id}</span> <span class="text-sub">${m.mechanism_of_action}</span></div>`;
        });
    }

    if (chemblData.activities.length > 0) {
        container.innerHTML += `<h4 class="section-title">Most Potent Experimental</h4>`;
        const categories = {};
        chemblData.activities.forEach(a => {
            if (!a.standard_value || !a.standard_type) return;
            const val = parseFloat(a.standard_value);
            if (!categories[a.standard_type] || val < categories[a.standard_type].val) {
                categories[a.standard_type] = { id: a.molecule_chembl_id, val, unit: a.standard_units };
            }
        });
        Object.entries(categories).forEach(([type, data]) => {
            container.innerHTML += `<div class="ligand-item experimental">
                <span>${data.id} (${type})</span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="potency-value">${data.val} ${data.unit}</span>
                    <button class="pdb-btn-expand" onclick="focusOnLigand('${data.id}')">Interactions</button>
                </div>
            </div>`;
        });
    }

    if (container.innerHTML === '') container.innerHTML = '<p>No ligand information available.</p>';
    UI.tabContent.appendChild(container);
};

const renderSolvedStructures = async () => {
    const pdbs = currentData.uniProtKBCrossReferences?.filter(r => r.database === 'PDB') || [];
    if (pdbs.length === 0) { UI.tabContent.innerHTML = '<p>No solved structures.</p>'; return; }

    const list = document.createElement('div');
    list.className = 'pdb-explorer-list';

    pdbs.slice(0, 15).forEach(pdb => {
        const res    = pdb.properties.find(p => p.key === 'Resolution')?.value || '-';
        const method = pdb.properties.find(p => p.key === 'Method')?.value     || '-';

        const card = document.createElement('div');
        card.className = 'pdb-card';
        card.innerHTML = `
            <div class="pdb-card-summary">
                <div class="pdb-id-box">${pdb.id}</div>
                <div class="pdb-info-main">
                    <div class="pdb-method">${method} (${res})</div>
                    <div class="pdb-components-icons" id="icons-${pdb.id}">...</div>
                </div>
                <button class="pdb-btn-expand" onclick="loadPDBInViewer('${pdb.id}')" id="btn-load-${pdb.id}">View</button>
                <button class="pdb-btn-expand" onclick="togglePdbDetails('${pdb.id}')" id="btn-${pdb.id}">Details</button>
            </div>
            <div class="pdb-card-details hidden" id="details-${pdb.id}">Loading...</div>
        `;
        list.appendChild(card);
        fetchIconsSummary(pdb.id);
    });

    UI.tabContent.appendChild(list);
};

const renderChains = () => {
    const container = document.createElement('div');
    container.className = 'chain-visibility-tab';
    
    let html = `
        <div style="font-size:0.95rem; font-weight:600; margin-bottom:1rem; color:var(--accent);">
            Structure Chains (${isAlphaFold ? '1' : structureChains.length})
        </div>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem;">
            Toggle checkboxes to hide/show individual protein chains in the 3D viewer.
        </p>
        <div class="chain-toggle-list" style="display:flex; flex-direction:column; gap:0.75rem;">
    `;

    if (isAlphaFold) {
        const gene = UI.geneName.innerText || 'Target';
        const isHidden = hiddenChains.has('A');
        html += `
            <div class="chain-toggle-item ${isHidden ? 'hidden' : ''}" 
                 onclick="const cb = this.querySelector('input'); cb.checked = !cb.checked; toggleChainVisibility('A', cb.checked); this.classList.toggle('hidden', !cb.checked);"
                 style="cursor:pointer; background:rgba(255,255,255,0.05); padding:0.75rem 1rem; border-radius:10px; display:flex; align-items:center; gap:1rem; border:1px solid rgba(255,255,255,0.1);">
                <input type="checkbox" ${isHidden ? '' : 'checked'} style="pointer-events:none; width:18px; height:18px;">
                <div style="flex-grow:1;">
                    <div style="font-weight:700;">Chain A</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${gene} (AlphaFold Prediction)</div>
                </div>
            </div>
        `;
    } else {
        structureChains.forEach(ch => {
            const isHidden = hiddenChains.has(ch.id);
            html += `
                <div class="chain-toggle-item ${isHidden ? 'hidden' : ''}" 
                     onclick="const cb = this.querySelector('input'); cb.checked = !cb.checked; toggleChainVisibility('${ch.id}', cb.checked); this.classList.toggle('hidden', !cb.checked);"
                     style="cursor:pointer; background:rgba(255,255,255,0.05); padding:0.75rem 1rem; border-radius:10px; display:flex; align-items:center; gap:1rem; border:1px solid rgba(255,255,255,0.1);">
                    <input type="checkbox" ${isHidden ? '' : 'checked'} style="pointer-events:none; width:18px; height:18px;">
                    <div style="flex-grow:1;">
                        <div style="font-weight:700;">Chain ${ch.id}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${ch.gene}</div>
                    </div>
                </div>
            `;
        });
    }

    if (!isAlphaFold && structureChains.length === 0) {
        html += '<div class="pocket-loading">Detecting chains... Please wait.</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    UI.tabContent.appendChild(container);
};

const fetchIconsSummary = async (pdbId) => {
    const entry = await fetchPDBEntry(pdbId);
    if (!entry) return;
    const iconsBox = document.getElementById(`icons-${pdbId}`);
    if (!iconsBox) return;

    let html = '';
    const proteins = entry.rcsb_entry_container_identifiers.polymer_entity_ids     || [];
    const ligands  = entry.rcsb_entry_container_identifiers.non_polymer_entity_ids || [];

    if (proteins.length > 0) html += `<span title="${proteins.length} Proteins" style="color:var(--secondary)">🧬 x${proteins.length}</span>`;
    if (ligands.length  > 0) html += `<span title="${ligands.length} Ligands"  style="color:#10b981">💊 x${ligands.length}</span>`;

    iconsBox.innerHTML = html;
};

/** Load a specific PDB entry in the main viewer from the Structures tab */
window.loadPDBInViewer = async (pdbId) => {
    isAlphaFold = false;
    hiddenChains.clear();
    UI.structureSource.innerText = `PDB: ${pdbId}`;
    UI.plddtLegend.classList.add('hidden');
    await loadPDBStructure(pdbId);
    await fetchFullEntityMetadata(pdbId);
    document.querySelector('.viewer-card').scrollIntoView({ behavior: 'smooth' });
};

window.togglePdbDetails = async (pdbId) => {
    const detailsBox = document.getElementById(`details-${pdbId}`);
    const btn        = document.getElementById(`btn-${pdbId}`);

    if (expandedPdb === pdbId) {
        detailsBox.classList.add('hidden');
        btn.innerText = 'Details';
        expandedPdb = null;
        return;
    }

    if (expandedPdb) {
        document.getElementById(`details-${expandedPdb}`).classList.add('hidden');
        document.getElementById(`btn-${expandedPdb}`).innerText = 'Details';
    }

    detailsBox.classList.remove('hidden');
    btn.innerText = 'Hide';
    expandedPdb = pdbId;

    if (detailsBox.innerHTML === 'Loading...') {
        const entry = await fetchPDBEntry(pdbId);
        if (!entry) { detailsBox.innerHTML = 'Error loading details.'; return; }

        let html = `<div class="pdb-full-title">${entry.struct.title}</div>`;

        const cit = entry.citation?.[0];
        if (cit) {
            html += `<div class="pdb-citation">
                <strong>Publication:</strong> ${cit.title} (${cit.journal_abbrev}, ${cit.year})
                <div class="pdb-pub-links">
                    ${cit.pdbx_database_id_DOI    ? `<a href="https://doi.org/${cit.pdbx_database_id_DOI}" target="_blank" class="pub-link">DOI</a>` : ''}
                    ${cit.pdbx_database_id_PubMed ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${cit.pdbx_database_id_PubMed}" target="_blank" class="pub-link pubmed">PubMed</a>` : ''}
                </div>
            </div>`;
        }

        detailsBox.innerHTML = html;
    }
};

const renderCofactors = () => {
    const binders = currentData.comments?.filter(c => c.commentType === 'COFACTOR') || [];
    if (binders.length === 0) { UI.tabContent.innerHTML = '<p>No cofactor info.</p>'; return; }
    binders.forEach(b => {
        const div = document.createElement('div');
        div.className = 'binder-item';
        div.innerHTML = `<strong>${b.cofactors?.[0]?.name || 'Unknown'}</strong>: ${b.note?.texts?.[0]?.value || ''}`;
        UI.tabContent.appendChild(div);
    });
};

const renderVariants = () => {
    const variants = currentData.features?.filter(f => f.type === 'VARIANT' || f.type === 'MUTAGEN') || [];
    if (variants.length === 0) { UI.tabContent.innerHTML = '<p>No variant data found for this protein.</p>'; return; }

    const container = document.createElement('div');
    container.className = 'variant-list';

    variants.slice(0, 20).forEach(v => {
        const item = document.createElement('div');
        item.className = 'variant-item';
        
        let pathClass = 'path-uncertain';
        let pathLabel = 'Unknown';
        
        if (v.description?.toLowerCase().includes('pathogenic')) {
            pathClass = 'path-likely-pathogenic';
            pathLabel = 'Pathogenic';
        } else if (v.description?.toLowerCase().includes('benign')) {
            pathClass = 'path-benign';
            pathLabel = 'Benign';
        }

        item.innerHTML = `
            <div>
                <div class="variant-label">${v.alternativeSequence ? v.wildType + v.location.start.value + v.alternativeSequence : v.description}</div>
                <div class="text-sub">${v.description || 'No description'}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="pathogenicity ${pathClass}">${pathLabel}</span>
                <button class="pdb-btn-expand" onclick="focusOnResidue(${v.location.start.value}, '${v.wildType}${v.location.start.value}')">View</button>
            </div>
        `;
        container.appendChild(item);
    });
    UI.tabContent.appendChild(container);
};

const renderSimulations = async () => {
    const content = document.getElementById('tabContent');
    const pdbId = UI.structureSource.innerText.replace('PDB:', '').trim();
    if (!content) return;

    content.innerHTML = `
        <div class="simulation-lab">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
                <h4 style="margin:0;">🧪 Simulation Lab</h4>
                <div class="badge" style="background:var(--secondary); font-size:0.7rem;">GROMACS + MMPBSA Pipeline</div>
            </div>
            
            <!-- Setup Section -->
            <div class="card" style="background:rgba(255,255,255,0.03); margin-bottom:1.5rem; border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:0.85rem; font-weight:600; margin-bottom:1rem; color:var(--accent);">Configure New MD Simulation</div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div>
                        <label class="toolbar-label" style="display:block; margin-bottom:0.4rem;">Receptor Chain</label>
                        <select id="sim-receptor" class="color-select" style="width:100%;">
                            ${structureChains.map(ch => `<option value="${ch.id}">Chain ${ch.id} (${ch.gene})</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="toolbar-label" style="display:block; margin-bottom:0.4rem;">Ligand / Partner</label>
                        <select id="sim-ligand" class="color-select" style="width:100%;">
                            <optgroup label="Protein Chains (Dimer Sim)">
                                ${structureChains.map(ch => `<option value="PROT_${ch.id}">Chain ${ch.id} (${ch.gene})</option>`).join('')}
                            </optgroup>
                            <optgroup id="sim-small-mols" label="Small Molecules (GAFF2 Sim)">
                                <option disabled>Detecting ligands...</option>
                            </optgroup>
                        </select>
                    </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted); max-width:70%;">
                        Standard 100ns MD production run with 5 replicates and MMPBSA binding energy analysis. 
                        Requires GPU-enabled GROMACS environment.
                    </div>
                    <button class="pocket-highlight-btn" style="background:var(--primary); color:white; border:none; padding:0.6rem 1.2rem; font-weight:700;"
                            onclick="launchSimulation('${pdbId}')">
                        🚀 Launch Simulation
                    </button>
                </div>
            </div>

            <!-- Active / Recent Jobs Section -->
            <div id="sim-job-list">
                <div class="pocket-loading"><span class="spinner"></span> Checking job status...</div>
            </div>
        </div>
    `;

    // Fetch ligands for the dropdown
    fetchLigandsForSim(pdbId);
    // Fetch job list
    refreshSimulationJobs();
};

const fetchLigandsForSim = async (pdbId) => {
    try {
        const res = await fetch(`/api/pdb/ligands/${pdbId}`);
        const data = await res.json();
        const ligands = data.rcsb_entry_container_identifiers.non_polymer_entity_ids || [];
        const container = document.getElementById('sim-small-mols');
        if (!container) return;

        if (ligands.length === 0) {
            container.innerHTML = '<option disabled>No small molecules found</option>';
            return;
        }

        const options = await Promise.all(ligands.map(async lid => {
            const r = await fetch(`/api/pdb/nonpoly_entity/${pdbId}/${lid}`);
            const d = await r.json();
            const name = d.rcsb_nonpolymer_entity?.pdbx_description || `Ligand ${lid}`;
            const resname = d.rcsb_nonpolymer_instance_annotation?.[0]?.comp_id || name.split(' ')[0];
            return `<option value="MOL_${resname}">${name} (${resname})</option>`;
        }));
        container.innerHTML = options.join('');
    } catch (e) {
        console.error('Failed to fetch ligands for sim', e);
    }
};

const refreshSimulationJobs = async () => {
    const container = document.getElementById('sim-job-list');
    if (!container) return;

    try {
        const res = await fetch('/api/simulations/list');
        const jobs = await res.json();

        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="pocket-empty" style="border-top:1px solid var(--border); padding-top:2rem;">
                    <div style="font-size:2rem; margin-bottom:0.5rem;">📡</div>
                    <div style="font-weight:600;">No active or past simulations found.</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Launch a simulation to see it appear here.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="font-size:0.85rem; font-weight:600; margin-bottom:0.75rem;">📋 Recent Job Activity</div>
            <div style="display:flex; flex-direction:column; gap:0.6rem;">
                ${jobs.map(job => `
                    <div class="pocket-card" style="margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:700; font-size:0.9rem;">Job: ${job.job_id}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">Structure: <strong>${job.pdb_id}</strong> | Status: <span style="color:var(--accent);">${job.status}</span></div>
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                             <button class="res-chip" style="cursor:pointer; background:rgba(255,255,255,0.05);">Log</button>
                             <button class="res-chip" style="cursor:pointer; border-color:var(--primary);">View Result</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="text-sub">Failed to load jobs.</div>`;
    }
};

window.launchSimulation = async (pdbId) => {
    const receptor = document.getElementById('sim-receptor').value;
    const ligandVal = document.getElementById('sim-ligand').value;
    const type = ligandVal.startsWith('PROT_') ? 'protein' : 'smallmol';
    const ligand = ligandVal.replace('PROT_', '').replace('MOL_', '');

    try {
        const res = await fetch(`/api/simulations/run?pdb=${pdbId}&receptor=${receptor}&ligand=${ligand}&type=${type}`);
        const data = await res.json();
        if (data.job_id) {
            alert(`Simulation job ${data.job_id} has been queued!`);
            refreshSimulationJobs();
        }
    } catch (e) {
        alert('Failed to launch simulation: ' + e.message);
    }
};

/** Molecular Design: Boltz2 and Docking */
window.renderDesign = async () => {
    const content = document.getElementById('tabContent');
    const pdbId = UI.structureSource.innerText.replace('PDB:', '').trim();
    const accession = currentAccession || '';
    if (!content) return;

    content.innerHTML = `
        <div class="design-lab">
            <!-- Boltz-2 Section -->
            <div class="card" style="background:rgba(99,102,241,0.05); margin-bottom:1.5rem; border:1px solid rgba(99,102,241,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div style="font-size:1rem; font-weight:700; color:var(--primary);">🌀 Boltz-2 Co-folding</div>
                    <div class="badge" style="background:var(--primary);">New</div>
                </div>
                
                <div style="margin-bottom:1rem;">
                    <label class="toolbar-label" style="display:block; margin-bottom:0.4rem;">Target Sequence (Auto-filled from UniProt)</label>
                    <textarea id="boltz-target-seq" class="color-select" style="width:100%; height:60px; font-family:monospace; font-size:0.75rem; padding:0.5rem;" readonly>${currentData?.sequence?.value || ''}</textarea>
                </div>
                
                <div style="margin-bottom:1rem;">
                    <label class="toolbar-label" style="display:block; margin-bottom:0.4rem;">Binder/Ligand (SMILES or Protein Sequence)</label>
                    <textarea id="boltz-partner" class="color-select" style="width:100%; height:60px; font-family:monospace; font-size:0.75rem; padding:0.5rem;" placeholder="Paste SMILES (e.g. CC(=O)OC1=CC=CC=C1C(=O)O) or Amino Acid sequence..."></textarea>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">
                        Boltz-2 predicts structures for protein-protein and protein-ligand complexes.
                    </div>
                    <button class="pocket-highlight-btn" style="background:var(--primary); color:white; border:none;" onclick="runBoltz('${accession}')">
                        🔮 Generate YAML & Predict
                    </button>
                </div>
            </div>

            <!-- Docking Section -->
            <div class="card" style="background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.2);">
                <div style="font-size:1rem; font-weight:700; color:#10b981; margin-bottom:1rem;">💊 Molecular Docking (Gnina)</div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div>
                        <label class="toolbar-label" style="display:block; margin-bottom:0.4rem;">Receptor</label>
                        <select id="dock-receptor" class="color-select" style="width:100%;">
                            ${structureChains.map(ch => `<option value="${ch.id}">Chain ${ch.id}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="toolbar-label" style="display:block; margin-bottom:0.4rem;">Ligand (SMILES)</label>
                        <input id="dock-ligand" class="color-select" style="width:100%;" placeholder="e.g. C1=CC=C(C=C1)C(=O)O">
                    </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">
                        Automated docking into selected chain using Gnina's CNN scoring.
                    </div>
                    <button class="pocket-highlight-btn" style="background:#10b981; color:white; border:none;" onclick="runDocking('${pdbId}')">
                        🎯 Run Docking
                    </button>
                </div>
            </div>
        </div>
    `;
};

window.runBoltz = async (accession) => {
    const partner = document.getElementById('boltz-partner').value.trim();
    if (!partner) { alert('Please provide a binder sequence or SMILES.'); return; }
    
    const type = /^[ARNDCEQGHILKMFPSTWYV\s]+$/i.test(partner) ? 'protein' : 'ligand';
    
    try {
        const res = await fetch(`/api/boltz/run?accession=${accession}&partner=${encodeURIComponent(partner)}&type=${type}`);
        const data = await res.json();
        alert(`Boltz-2 job ${data.job_id} prepared. Command: boltz predict boltz_config.yaml`);
    } catch (e) {
        alert('Failed to prepare Boltz job');
    }
};

window.runDocking = async (pdbId) => {
    const receptor = document.getElementById('dock-receptor').value;
    const ligand = document.getElementById('dock-ligand').value.trim();
    if (!ligand) { alert('Please provide a ligand SMILES.'); return; }

    try {
        const res = await fetch(`/api/docking/run?pdb=${pdbId}&receptor=${receptor}&ligand=${encodeURIComponent(ligand)}`);
        const data = await res.json();
        alert(`Docking job ${data.job_id} prepared.`);
    } catch (e) {
        alert('Failed to prepare Docking job');
    }
};

// ───────────────────────────────────────────────
//  Pockets / Cavity Search
// ───────────────────────────────────────────────

// Active pocket highlight state
let activePocketIndex = null;

const renderPockets = async () => {
    // Need a current PDB structure loaded
    const pdbEntries = currentData?.uniProtKBCrossReferences?.filter(r => r.database === 'PDB') || [];
    if (pdbEntries.length === 0) {
        UI.tabContent.innerHTML = `
            <div class="pocket-empty">
                <div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>
                <div>Cavity search is only available for experimentally solved PDB structures.</div>
                <div class="text-sub" style="margin-top:0.4rem;">This entry has no PDB cross-references.</div>
            </div>`;
        return;
    }

    // Which PDB is currently shown in the viewer?
    const rawSource = UI.structureSource.innerText.replace('PDB:', '').trim();
    const shownPdbId = (rawSource.length === 4 ? rawSource : (pdbEntries[0]?.id || currentAccession)).toLowerCase();

    UI.tabContent.innerHTML = `
        <div class="pocket-header">
            <span class="text-sub">Loading binding pockets for <strong>${shownPdbId.toUpperCase()}</strong>…</span>
        </div>
        <div id="pocket-list"><div class="pocket-loading"><span class="spinner"></span> Fetching data…</div></div>`;

    // ─── Fetch from two confirmed-working APIs in parallel ───────────────────
    const [bmData, entryData] = await Promise.all([
        // PDBe graph-api bound_molecules → which ligands are present + chain/resnum
        fetch(`/api/pdb/bound_molecules/${shownPdbId}`)
            .then(r => r.ok ? r.json() : null).catch(() => null),
        // RCSB entry → non_polymer_entity_ids so we can query each ligand
        fetch(`/api/pdb/ligands/${shownPdbId}`)
            .then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const pocketList = document.getElementById('pocket-list');
    if (!pocketList) return;

    const pockets = [];

    // ─── Build pocket list from bound_molecules ───────────────────────────────
    // Each bound molecule (ligand / metal / co-factor) defines one cavity.
    const boundMols = bmData?.[shownPdbId] || [];

    // Filter out waters (HOH) and very small ions that aren't druggable
    const SKIP = new Set(['HOH', 'WAT', 'EDO', 'PEG', 'GOL', 'DMS', 'MPD', 'ACT', 'ACE', 'FMT', 'SO4', 'PO4', 'NO3', 'CL', 'NA', 'K', 'MG', 'CA']);

    for (const bm of boundMols) {
        const ligands = bm.composition?.ligands || [];
        const drugLigs = ligands.filter(l => !SKIP.has(l.chem_comp_id));
        const metalLigs = ligands.filter(l => SKIP.has(l.chem_comp_id) && ['ZN','FE','MN','CU','CO','NI','MO'].includes(l.chem_comp_id));
        const allLigs = drugLigs.length > 0 ? drugLigs : metalLigs;
        if (allLigs.length === 0) continue;

        const lig = allLigs[0];  // primary ligand in this pocket
        const extraNames = allLigs.slice(1).map(l => l.chem_comp_id).join(', ');

        pockets.push({
            label:    lig.chem_comp_id,
            fullName: extraNames ? `${lig.chem_comp_id} + ${extraNames}` : lig.chem_comp_id,
            chain:    lig.chain_id,
            resNum:   lig.author_residue_number,
            source:   'ligand',
        });
    }

    // ─── Also pull entity-level ligand info from RCSB for full names ─────────
    const nonPolyIds = entryData?.rcsb_entry_container_identifiers?.non_polymer_entity_ids || [];
    const entityInfoMap = {};
    await Promise.all(nonPolyIds.map(async eid => {
        try {
            const r = await fetch(`/api/pdb/nonpoly_entity/${shownPdbId}/${eid}`);
            if (!r.ok) return;
            const d = await r.json();
            const compId = d?.pdbx_entity_nonpoly?.comp_id;
            const name   = d?.pdbx_entity_nonpoly?.name || d?.rcsb_nonpolymer_entity?.pdbx_description;
            if (compId) entityInfoMap[compId] = name;
        } catch (_) {}
    }));

    // Enrich pockets with human-readable ligand names
    pockets.forEach(p => {
        if (entityInfoMap[p.label]) p.humanName = entityInfoMap[p.label];
    });

    if (pockets.length === 0) {
        pocketList.innerHTML = `
            <div class="pocket-empty">
                <div style="font-size:2rem;margin-bottom:0.5rem;">🕳️</div>
                <div>No co-crystallized ligands found in <strong>${shownPdbId.toUpperCase()}</strong>.</div>
                <div class="text-sub" style="margin-top:0.4rem;">Use the Geometric Cavity Search below to predict pockets without requiring a bound ligand.</div>
            </div>`;
        // Fall through to add the geometric cavity search section below
    } else {


    pocketList.innerHTML = `<div class="text-sub" style="margin-bottom:0.6rem;">${pockets.length} binding pocket${pockets.length > 1 ? 's' : ''} identified — click <strong>Show</strong> to highlight in the 3D viewer.</div>`;

    const COLORS = [
        {r:255,g:165,b:0},   // orange
        {r:255,g:100,b:100}, // coral
        {r:100,g:220,b:255}, // cyan
        {r:180,g:130,b:255}, // lavender
        {r:100,g:255,b:160}, // mint
    ];

    pockets.forEach((pocket, idx) => {
        const col = COLORS[idx % COLORS.length];
        const rgbStr = `rgb(${col.r},${col.g},${col.b})`;

        const card = document.createElement('div');
        card.className = 'pocket-card';
        card.id = `pocket-card-${idx}`;
        card.innerHTML = `
            <div class="pocket-card-top">
                <div>
                    <div class="pocket-name">
                        <span class="pocket-color-dot" style="background:${rgbStr};width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0;"></span>
                        ${pocket.label}
                        <span class="pocket-badge binding">Ligand-bound</span>
                    </div>
                    ${pocket.humanName ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.3rem;">${pocket.humanName}</div>` : ''}
                    <div class="pocket-stats">
                        <span class="pocket-stat">Chain <strong>${pocket.chain}</strong></span>
                        <span class="pocket-stat">Residue <strong>${pocket.resNum}</strong></span>
                    </div>
                </div>
                <button class="pocket-highlight-btn" id="phl-btn-${idx}"
                    onclick="highlightPocket(${idx})">
                    🎯 Show
                </button>
            </div>`;
        pocketList.appendChild(card);
    });

    window._pockets = pockets;
    }  // end else (pockets.length > 0)

    // ─── Geometric Cavity Search section (always shown) ──────────────────────
    const divider = document.createElement('div');

    const chainOptions = structureChains.map(ch => 
        `<option value="${ch.id}">Chain ${ch.id} (${ch.gene})</option>`
    ).join('');

    divider.style.cssText = 'margin:1.2rem 0 0.8rem;border-top:1px solid rgba(255,255,255,0.08);padding-top:1rem;';
    divider.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div>
                <div style="font-size:0.92rem;font-weight:600;color:var(--text-primary);margin-bottom:0.2rem;">
                    🧪 Geometric Cavity Search
                </div>
                <div style="font-size:0.78rem;color:var(--text-muted);">
                    Pure-geometry pocket prediction — finds all surface clefts &amp; buried cavities.
                </div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <select id="cavity-chain-select" class="color-select" style="padding:0.4rem; height:auto; font-size:0.8rem;">
                    <option value="">Entire Structure</option>
                    ${chainOptions}
                </select>
                <button class="pocket-highlight-btn" id="run-cavity-btn"
                    onclick="runCavitySearch('${shownPdbId}')">
                    🔬 Run Search
                </button>
            </div>
        </div>
        <div id="cavity-results" style="margin-top:0.8rem;"></div>
    `;
    pocketList.appendChild(divider);
};

/** Run server-side geometric cavity detection */
window.runCavitySearch = async (pdbId) => {
    const btn = document.getElementById('run-cavity-btn');
    const results = document.getElementById('cavity-results');
    const chainSelect = document.getElementById('cavity-chain-select');
    const selectedChain = chainSelect ? chainSelect.value : '';
    
    if (!results) return;

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Computing…'; }
    const chainText = selectedChain ? `Chain <strong>${selectedChain}</strong>` : 'entire structure';
    results.innerHTML = `<div class="pocket-loading"><span class="spinner"></span> Running pocket detection on ${chainText} — this may take 5–15 seconds…</div>`;

    try {
        const url = selectedChain ? `/api/cavity_search/${pdbId}/${selectedChain}` : `/api/cavity_search/${pdbId}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Server error ${resp.status}`);
        const data = await resp.json();

        if (!data.cavities || data.cavities.length === 0) {
            results.innerHTML = `<div class="pocket-empty" style="padding:0.8rem;">No geometric cavities found. The structure may be too flat or too small.</div>`;
            if (btn) { btn.disabled = false; btn.textContent = '🔬 Run Search'; }
            return;
        }

        const COLORS = [
            {r:255,g:200,b:0},    // gold
            {r:50,g:200,b:255},   // sky
            {r:255,g:80,b:180},   // rose
            {r:80,g:255,b:130},   // green
            {r:200,g:100,b:255},  // purple
            {r:255,g:130,b:60},   // tangerine
        ];

        results.innerHTML = `
            <div class="text-sub" style="margin-bottom:0.6rem;">
                ${data.cavities.length} geometric pocket${data.cavities.length > 1 ? 's' : ''} detected
                — click <strong>Show</strong> to highlight lining residues with side chains.
            </div>`;

        data.cavities.forEach((cav, idx) => {
            const col = COLORS[idx % COLORS.length];
            const rgb = `rgb(${col.r},${col.g},${col.b})`;

            // Druggability score: based on volume, depth, and residue count
            const volScore = Math.min(cav.volume / 500, 1.0); // 500 Å³ = ideal
            const depthScore = Math.min(cav.depth / 8, 1.0);  // 8 Å deep = ideal
            const resScore = Math.min(cav.residues.length / 20, 1.0); // 20+ residues
            const drugScore = Math.round((volScore * 0.4 + depthScore * 0.35 + resScore * 0.25) * 100);
            const drugLabel = drugScore >= 70 ? 'Druggable' : drugScore >= 40 ? 'Moderate' : 'Low';
            const drugClass = drugScore >= 70 ? 'path-pathogenic' : drugScore >= 40 ? 'path-uncertain' : 'path-benign';

            const resChips = cav.residues.slice(0, 10).map(r =>
                `<span class="res-chip" title="Distance to pocket: ${r.dist ?? '?'} Å">${r.chain}:${r.resname}${r.resseq}</span>`
            ).join('');
            const more = cav.residues.length > 10
                ? `<span class="res-chip muted" onclick="this.parentElement.classList.toggle('expanded')" style="cursor:pointer;">+${cav.residues.length - 10} more</span>` : '';

            const card = document.createElement('div');
            card.className = 'pocket-card';
            card.id = `cav-card-${idx}`;
            card.innerHTML = `
                <div class="pocket-card-top">
                    <div>
                        <div class="pocket-name">
                            <span style="background:${rgb};width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0;"></span>
                            Cavity ${idx + 1}
                            <span class="pocket-badge fpocket">Geometric</span>
                            <span class="pocket-badge ${drugClass}" title="Druggability: ${drugScore}%">${drugLabel} (${drugScore}%)</span>
                        </div>
                        <div class="pocket-stats">
                            <span class="pocket-stat">Volume <strong>${Math.round(cav.volume)} Å³</strong></span>
                            <span class="pocket-stat">Depth <strong>${cav.depth.toFixed(1)} Å</strong></span>
                            <span class="pocket-stat">${cav.residues.length} lining res.</span>
                        </div>
                        ${cav.residues.length > 0 ? `<div class="pocket-residues" style="margin-top:0.4rem;">${resChips}${more}</div>` : ''}
                    </div>
                    <button class="pocket-highlight-btn" id="cav-btn-${idx}"
                        onclick="highlightCavity(${idx})">
                        🎯 Show
                    </button>
                </div>`;
            results.appendChild(card);
        });

        window._cavities = data.cavities;
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Re-run'; }

    } catch (err) {
        results.innerHTML = `<div class="pocket-empty" style="padding:0.8rem;color:#f08;"><strong>Error:</strong> ${err.message}</div>`;
        if (btn) { btn.disabled = false; btn.textContent = '🔬 Run Search'; }
    }
};

/** Highlight all lining residues of a geometric cavity in the Molstar viewer (CavityPlus-style) */
window.highlightCavity = (idx) => {
    const cavities = window._cavities || [];
    const cav = cavities[idx];
    if (!cav || !viewerPlugin?.visual) return;

    // Clear existing active state
    document.querySelectorAll('[id^="cav-card-"]').forEach(c => c.classList.remove('pocket-active'));
    document.querySelectorAll('[id^="cav-btn-"]').forEach(b => { b.textContent = '🎯 Show'; b.classList.remove('active'); });

    const btn  = document.getElementById(`cav-btn-${idx}`);
    const card = document.getElementById(`cav-card-${idx}`);

    if (window._activeCavIdx === idx) {
        window._activeCavIdx = null;
        try {
            viewerPlugin.visual.clearSelection();
            viewerPlugin.visual.reset({ camera: true, theme: true });
        } catch (_) {}
        return;
    }

    window._activeCavIdx = idx;
    if (btn)  { btn.textContent = '✕ Clear'; btn.classList.add('active'); }
    if (card) card.classList.add('pocket-active');

    const COLORS = [
        {r:255,g:200,b:0}, {r:50,g:200,b:255}, {r:255,g:80,b:180},
        {r:80,g:255,b:130}, {r:200,g:100,b:255}, {r:255,g:130,b:60},
    ];
    const col = COLORS[idx % COLORS.length];

    // CavityPlus-style: show lining residues with side chains + ball-and-stick
    const selData = cav.residues.map((r, i) => ({
        residue_number: r.resseq,
        auth_asym_id:   r.chain,
        color:          col,
        sideChain:      true,                    // Show side chains
        representation: 'ball-and-stick',         // Ball-and-stick for pocket lining
        representationColor: col,
        focus:          i === 0,                  // Focus on first residue
    }));

    try {
        viewerPlugin.visual.select({
            data: selData,
            nonSelectedColor: { r: 40, g: 40, b: 55 },
        });
        // Also focus on all lining residues as a group
        viewerPlugin.visual.focus(selData.map(s => ({
            residue_number: s.residue_number,
            auth_asym_id: s.auth_asym_id,
        })));
    } catch (e) {
        console.warn('Cavity highlight failed:', e);
    }

    document.querySelector('.viewer-card')?.scrollIntoView({ behavior: 'smooth' });
};


/** Focus the viewer on a ligand-defined pocket */
window.highlightPocket = (idx) => {
    const pockets = window._pockets || [];
    const pocket  = pockets[idx];
    if (!pocket || !viewerPlugin?.visual) return;

    // Clear previous selection UI
    if (activePocketIndex !== null) {
        const prevBtn  = document.getElementById(`phl-btn-${activePocketIndex}`);
        const prevCard = document.getElementById(`pocket-card-${activePocketIndex}`);
        if (prevBtn)  { prevBtn.textContent = '🎯 Show'; prevBtn.classList.remove('active'); }
        if (prevCard) prevCard.classList.remove('pocket-active');
    }

    // Toggle off if clicking the same pocket
    if (activePocketIndex === idx) {
        activePocketIndex = null;
        try { viewerPlugin.visual.reset({ camera: false }); } catch (_) {}
        return;
    }

    activePocketIndex = idx;
    const btn  = document.getElementById(`phl-btn-${idx}`);
    const card = document.getElementById(`pocket-card-${idx}`);
    if (btn)  { btn.textContent = '✕ Clear'; btn.classList.add('active'); }
    if (card) card.classList.add('pocket-active');

    const COLORS = [
        {r:255,g:165,b:0},
        {r:255,g:100,b:100},
        {r:100,g:220,b:255},
        {r:180,g:130,b:255},
        {r:100,g:255,b:160},
    ];
    const col = COLORS[idx % COLORS.length];

    try {
        // Select and focus the ligand residue by chain + residue number
        viewerPlugin.visual.select({
            data: [{
                residue_number: pocket.resNum,
                auth_asym_id:   pocket.chain,
                color:          col,
                focus:          true,
            }],
            nonSelectedColor: { r: 30, g: 30, b: 50 },
        });
    } catch (e) {
        console.warn('Pocket highlight failed:', e);
    }

    document.querySelector('.viewer-card')?.scrollIntoView({ behavior: 'smooth' });
};

window.focusOnResidue = (residueIndex, label) => {
    try {
        if (viewerPlugin && viewerPlugin.visual) {
            viewerPlugin.visual.select({
                data: [{ residue_number: residueIndex, focus: true, color: {r: 255, g: 219, b: 19} }],
                nonSelectedColor: {r: 50, g: 50, b: 50}
            });
        }
    } catch (e) {
        console.warn('Focus failed', e);
    }
    document.querySelector('.viewer-card').scrollIntoView({ behavior: 'smooth' });
};


// ───────────────────────────────────────────────
//  Sequence search path
// ───────────────────────────────────────────────
const showSequenceResults = (seq) => {
    UI.hero.classList.add('hidden');
    UI.results.classList.add('hidden');
    UI.seqResults.classList.remove('hidden');
    document.getElementById('matchTable').innerHTML = 'Searching UniProt matches...';
};

// ───────────────────────────────────────────────
//  Main entry point
// ───────────────────────────────────────────────
const analyze = async () => {
    const input = UI.input.value.trim();
    if (!input) return;
    if (isSequence(input)) {
        showSequenceResults(input);
    } else {
        await fetchProteinData(input);
    }
};

// ───────────────────────────────────────────────
//  Event listeners  (keydown, not deprecated keypress)
// ───────────────────────────────────────────────
UI.searchBtn.addEventListener('click', analyze);

// FIX: stopPropagation prevents pdbe-molstar (or any other lib) from
// intercepting keyboard events while the user types in the search box.
UI.input.addEventListener('keydown', (e) => {
    e.stopPropagation();   // ← critical: stop molstar keyboard shortcuts
    if (e.key === 'Enter') {
        e.preventDefault();
        analyze();
    }
}, true); // capture phase for maximum priority

// Also prevent keyup/keypress from bubbling out of the input
UI.input.addEventListener('keyup',    e => e.stopPropagation(), true);
UI.input.addEventListener('keypress', e => e.stopPropagation(), true);

UI.tabs.forEach(btn => btn.addEventListener('click', () => updateTabs(btn.dataset.tab)));

window.focusOnLigand = (ligandId) => {
    try {
        if (viewerPlugin && viewerPlugin.visual) {
            viewerPlugin.visual.select({
                data: [
                    { struct_as_auth_id: ligandId, color: {r: 255, g: 0, b: 0}, focus: true },
                    { struct_as_auth_id: ligandId, radius: 5, color: {r: 0, g: 255, b: 0} }
                ],
                nonSelectedColor: {r: 200, g: 200, b: 200}
            });
        }
    } catch (e) { console.warn('Ligand focus failed', e); }
    document.querySelector('.viewer-card').scrollIntoView({ behavior: 'smooth' });
};

