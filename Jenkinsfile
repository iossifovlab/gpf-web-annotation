pipeline {
    agent { label 'eyoree' }
    options {
        quietPeriod(0);
        copyArtifactPermission('/iossifovlab/*,/seqpipe/*');
        disableConcurrentBuilds()
    }
    triggers {
        upstream(upstreamProjects: 'iossifovlab/gpf-conda-packaging/master', threshold: hudson.model.Result.SUCCESS)
    }

    stages {
        stage('Start') {
            steps {
                zulipSend(
                message: "Started build #${env.BUILD_NUMBER} of project ${env.JOB_NAME} (${env.BUILD_URL})",
                topic: "${env.JOB_NAME}")
            }
        }

        stage('Copy artifacts') {
            steps {
                copyArtifacts(
                    filter: "results/conda-channel.tar.gz",
                    fingerprintArtifacts: true,
                    projectName: "iossifovlab/gpf-conda-packaging/master",
                    selector: lastSuccessful()
                )
                sh "tar -xzf results/conda-channel.tar.gz"
            }
        }

        stage('Build') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build gpf-dev"
                sh "docker compose -f compose-jenkins.yaml build"
            }
        }

        stage('Run Backend Tests') {
            steps {
                sh "docker compose -f compose-jenkins.yaml run backend-tests"
            }
        }

    }

  post {
    always {
      script {
        sh "docker compose -f compose-jenkins.yaml down --remove-orphans"


        try {
            def resultBeforeTests = currentBuild.currentResult
            junit 'results/backend-tests-junit.xml'
            sh "test ${resultBeforeTests} == ${currentBuild.currentResult}"

            recordCoverage sourceCodeEncoding: 'UTF-8',
                enabledForFailure: true,
                sourceCodeRetention: 'LAST_BUILD',
                sourceDirectories: "backend/gpf_web_annotation_backend",
                tools: [
                    [parser: 'COBERTURA', pattern: 'results/backend-coverage.xml']
                ]

        } finally {
          zulipNotification(
            topic: "${env.JOB_NAME}"
          )
        }
      }
    }
  }
}
