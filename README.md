### Backend Dependency Installation

```bash
mamba env remove -n gpf-web-annotation
mamba env create --name gpf-web-annotation --file ./backend/gpf/environment.yml
mamba env update --file ./backend/environment.yml
conda run -n gpf-web-annotation pip install -e ./backend/gpf/dae
conda activate gpf-web-annotation
pip install -e ./backend
mamba env update -n gpf-web-annotation --file ./backend/dev-environment.yml
```

### Frontend Dependency Installation

```bash
cd frontend
npm install
```

### Running the app

Run celery

```bash
cd backend
conda activate gpf-web-annotation
export DJANGO_SETTINGS_MODULE=web_annotation.settings
export GRR_DEFINITION_FILE=~/grr_definition.yaml
celery -A web_annotation.celery_app worker -l INFO
```

Run the backend

```bash
cd backend
conda activate gpf-web-annotation
python manage.py migrate
python manage.py runserver

```

Run the frontend

```bash
cd frontend
ng serve
```

### Running frontend tests

```bash
cd frontend
npm test
```

### Running backend tests

```bash
cd backend
export DJANGO_SETTINGS_MODULE=web_annotation.test_settings
pytest web_annotation/tests/
```
