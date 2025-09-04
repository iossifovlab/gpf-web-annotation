### Backend Dependency Installation

```bash
mamba env remove -n gpf-web-annotation
mamba env create --name gpf-web-annotation --file ./backend/gpf/environment.yml
mamba env update --file ./backend/environment.yml
conda run -n gpf-web-annotation pip install -e ./backend/gpf/dae
```
