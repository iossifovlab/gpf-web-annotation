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

COPY environment.yml /
RUN mamba env update -y -n gpf --file /environment.yml


COPY django-gpf-web-annotation/dist/django_gpf_web_annotation-0.1-py3-none-any.whl /


RUN mamba run -n gpf pip install /django_gpf_web_annotation-0.1-py3-none-any.whl

RUN conda-pack -n gpf -o /tmp/gpf.tar && \
  mkdir /gpf && cd /gpf && tar xf /tmp/gpf.tar && \
  rm /tmp/gpf.tar

RUN /gpf/bin/conda-unpack


FROM ubuntu:24.04 AS runtime

COPY --from=build /gpf /gpf

RUN DEBIAN_FRONTEND=noninteractive apt-get update --fix-missing && \
	DEBIAN_FRONTEND=noninteractive apt-get install -y \
		supervisor less curl wget \
		apache2 mysql-client && \
	DEBIAN_FRONTEND=noninteractive apt-get clean

RUN mkdir -p /logs
RUN mkdir -p /site

COPY frontend/dist/frontend/browser /site/gpf-web-annotation



WORKDIR /site


# configure apache2
RUN mkdir -p /var/run/apache2

ENV APACHE_LOG_DIR=/var/log/apache2
ENV APACHE_LOCK_DIR=/var/lock/apache2
ENV APACHE_RUN_GROUP=www-data
ENV APACHE_RUN_DIR=/var/run/apache2
ENV APACHE_RUN_USER=www-data
ENV APACHE_PID_FILE=/var/run/apache2/apache2.pid

COPY ./scripts/localhost.conf /etc/apache2/sites-available/

RUN cat /etc/hostname | awk '{print "ServerName "$1}' >> /etc/apache2/apache2.conf
RUN echo "SetEnv proxy-initial-not-pooled 1" >> /etc/apache2/apache2.conf

RUN rm -f /etc/apache2/sites-enabled/000-default.conf

COPY ./scripts/supervisord.conf /etc/
COPY ./scripts/supervisord-bootstrap.sh /
COPY ./scripts/wait-for-it.sh /
RUN chmod +x /*.sh

EXPOSE 80 443

ENTRYPOINT ["supervisord", "-c", "/etc/supervisord.conf", "-n"]
