FROM condaforge/mambaforge:latest AS build

RUN mamba update -y -n base -c conda-forge -y mamba
RUN mamba install -y -n base -c conda-forge conda-pack=0.8.1

RUN mkdir conda-channel
COPY conda-channel /conda-channel/

RUN mamba create -n gpf -y
RUN mamba install -y -n gpf \
    -c conda-forge \
    -c bioconda \
    -c file:///conda-channel \
    gpf_dae

WORKDIR /app

COPY environment.yml .
RUN mamba env update -y -n gpf --file ./environment.yml

# Copy the rest of the application source code into the container
COPY . .

RUN mamba run -n gpf pip install .

RUN conda-pack -n gpf -o /tmp/gpf.tar && \
  mkdir /gpf && cd /gpf && tar xf /tmp/gpf.tar && \
  rm /tmp/gpf.tar

RUN /gpf/bin/conda-unpack


FROM ubuntu:24.04 AS runtime

COPY --from=build /gpf /gpf

RUN DEBIAN_FRONTEND=noninteractive apt-get update --fix-missing
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
		supervisor curl less
RUN DEBIAN_FRONTEND=noninteractive apt-get clean

RUN mkdir -p /logs


COPY ./scripts/supervisord.conf /etc/
COPY ./scripts/supervisord-bootstrap.sh /
COPY ./scripts/wait-for-it.sh /
RUN chmod +x /*.sh

EXPOSE 80 443

ADD ./scripts/grr-definition.yaml /

ENTRYPOINT ["supervisord", "-c", "/etc/supervisord.conf", "-n"]
