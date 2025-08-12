FROM condaforge/mambaforge:latest

ADD backend /wd/backend

RUN /opt/conda/bin/mamba update -n base -c conda-forge conda
RUN /opt/conda/bin/mamba env create --file /wd/backend/environment.yml
RUN /opt/conda/bin/mamba env list
RUN /opt/conda/bin/conda run --no-capture-output -n gpf-web-annotation pytest /wd/backend/tests \
	--junitxml=/wd/test-results/backend-tests-junit.xml \
	--cov-config /wd/backend/coveragerc \
	--cov /wd/backend

RUN /opt/conda/bin/conda run -n gpf-web-annotation coverage xml -o /wd/test-results/coverage.xml
