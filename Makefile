frontend:
	set -e; set -x; \
	cd frontend; \
	npm i; \
	npx ng build --configuration development --base-href "/static/" --source-map; \
	rm -rf ../django-gpf-web-annotation-frontend/gpf_web_annotation_frontend/static; \
	pwd; \
	cp -r dist/frontend/browser ../django-gpf-web-annotation-frontend/gpf_web_annotation_frontend/static; \
	cd ../django-gpf-web-annotation-frontend/; \
	pip install build python-magic; \
	python -m build .; \
	pip install dist/django_gpf_web_annotation_frontend-0.1-py3-none-any.whl --force-reinstall; \
	cd ../backend/; \
	rm -rf pesho/* static-root/*

backend:
	set -e; set -x; \
	cd django-gpf-web-annotation-backend; \
	rm -r *.egg-info dist/*; \
	python -m build .; \
	pip install dist/django_gpf_web_annotation_backend-0.1-py3-none-any.whl --force-reinstall;

