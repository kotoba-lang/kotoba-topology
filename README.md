# Languages as Graph Topologies

**A Computational Framework for Cross-Linguistic Syntactic Structure Analysis**

## Interactive emphasis lab / 強調を操作する実験室

The new [browser demo](web/index.html) explores **four hand-annotated Japanese/English sentence pairs**. Select a word and independently change bold, italics, capitals, simulated pitch, intensity, duration, syllable position, and phrase boundaries. Compare the dependency graph, focus alternatives, reference/current scores, and a word-by-word calculation trace. Export an experiment as JSON or save its settings in the URL fragment.

Build a self-contained HTML file (Node.js 22 or newer; no npm dependencies):

```sh
node scripts/build-demo.mjs
open dist/index.html
```

Or serve the source from a local static server:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory web
# Open http://127.0.0.1:8765
```

The demo executes in the browser and makes no service requests. Its scores are **illustrative, not corpus measurements, human interpretation probabilities, or cognitive-load estimates**. The synthesized preview is a local tone pattern, not spoken language. The existing paper and Python figures are separate, earlier material; the demo does not validate their empirical or mathematical claims.

Run the model checks with `node --test tests/model.test.mjs`. See [the model, browser checks, and qualification limits](docs/emphasis-lab.md) for details. Shared Kotoba client-runtime integration is pending the missing canonical broker; no replacement validator or consent logic is included.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![arXiv](https://img.shields.io/badge/arXiv-2026.XXXXX-b31b1b.svg)](https://arxiv.org/)

## Abstract

We propose a novel framework for representing natural language syntactic structures as graph topologies, enabling systematic cross-linguistic comparison through topological invariants. By modeling the dependency structures of five typologically diverse languages (English, Japanese, Hindi, French, and Arabic) as directed graphs, we compute topological metrics including tree depth, branching factor, head directionality, dependency distance distributions, and Betti numbers.

## Repository Structure

```
.
├── main.tex                 # LaTeX source (main paper)
├── references.bib           # BibTeX references
├── figures/
│   ├── fig1_dependency_trees.png   # Dependency graph topologies (Fig. 1)
│   ├── fig2_radar.png              # Topological metrics radar chart (Fig. 2)
│   ├── fig3_topology_types.png     # Canonical topology types (Fig. 3)
│   ├── fig4_dep_distance.png       # Dependency distance distributions (Fig. 4)
│   └── fig5_betti.png              # Betti numbers comparison (Fig. 5)
├── src/
│   └── generate_figures.py  # Python script to regenerate all figures
├── LICENSE                  # Apache License 2.0
└── README.md
```

## Building the Paper

### Prerequisites

- TeX Live or equivalent LaTeX distribution
- Python 3.8+ (for regenerating figures)

### Compile PDF

```bash
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

### Regenerate Figures

```bash
pip install networkx matplotlib numpy scipy
python src/generate_figures.py
```

## Key Contributions

1. **Graph-topological formalization** of syntactic structure across five typologically diverse languages
2. **Five quantitative metrics** for cross-linguistic comparison: tree depth, branching factor, head directionality index (HDI), crossing number, and mean dependency distance (MDD)
3. **Topological invariants** (Betti numbers, Euler characteristic) applied to syntactic structures
4. **Computational metaphors** derived from topology: convergent (SOV), divergent (SVO), and broadcast (VSO) computation

## Languages Analyzed

| Language | Word Order | HDI  | Topology Type |
|----------|-----------|------|---------------|
| English  | SVO       | 0.75 | Divergent     |
| Japanese | SOV       | 0.15 | Convergent    |
| Hindi    | SOV       | 0.25 | Convergent    |
| French   | SVO       | 0.70 | Divergent     |
| Arabic   | VSO       | 0.60 | Broadcast     |

## Citation

```bibtex
@article{kawasaki2026languages,
  title   = {Languages as Graph Topologies: A Computational Framework
             for Cross-Linguistic Syntactic Structure Analysis},
  author  = {Kawasaki, Jun},
  year    = {2026},
  note    = {Preprint}
}
```

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.
