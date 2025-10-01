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
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
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
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml build gpf-dev"
                sh "docker compose -f compose-jenkins.yaml build"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
            }
        }

        stage('Run Backend Linters') {
            steps {
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run backend-linters"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
            }
        }

        stage('Run Backend Tests') {
            steps {
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run backend-tests"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
            }
        }

        stage('Run Frontend Linters') {
            steps {
                sh "mkdir -p frontend/reports"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run frontend-linters"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
            }
        }

        stage('Run Frontend Tests') {
            steps {
                sh "mkdir -p frontend/reports"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run frontend-tests"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
            }
        }

        stage('Run E2E Tests') {
            steps {
                sh "mkdir -p e2e-tests/reports"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run e2e-tests"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
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
            junit 'frontend/reports/junit-report.xml'
            sh "test ${resultBeforeTests} == ${currentBuild.currentResult}"
            junit 'e2e-tests/reports/junit-report.xml'
            sh "test ${resultBeforeTests} == ${currentBuild.currentResult}"


            recordCoverage sourceCodeEncoding: 'UTF-8',
                enabledForFailure: true,
                sourceCodeRetention: 'LAST_BUILD',
                tools: [
                    [parser: 'COBERTURA', pattern: 'results/backend-coverage.xml']
                ]

            recordIssues(
                enabledForFailure: true, aggregatingResults: false,
                tools: [
                    flake8(
                        pattern: 'results/ruff_report', reportEncoding: 'UTF-8',
                        id: 'ruff', name: 'Ruff'),
                    myPy(
                        pattern: 'results/mypy_report', reportEncoding: 'UTF-8',
                        id: 'mypy', name: 'MyPy'),
                    pyLint(
                        pattern: 'results/pylint_report', reportEncoding: 'UTF-8',
                        id: 'pylint', name: 'PyLint'),
                    checkStyle(
                        pattern: 'frontend/reports/css-lint-report.xml',
                        reportEncoding: 'UTF-8', id: 'checkstyle-css',
                        name: 'CSS lint'),
                    checkStyle(
                        pattern: 'frontend/reports/ts-lint-report.xml',
                        reportEncoding: 'UTF-8', id: 'checkstyle-ts',
                        name: 'TS lint'),
                ],
                qualityGates: [[threshold: 1, type: 'DELTA', unstable: true]]
            )

            publishHTML (target : [allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'results/coverage-html',
                reportFiles: 'index.html',
                reportName: 'gpf-web-annotation-coverage',
                reportTitles: 'gpf-web-annotation-coverage'])

            archiveArtifacts artifacts: 'e2e-tests/reports/**', fingerprint: false, allowEmptyArchive: true

        } finally {
          zulipNotification(
            topic: "${env.JOB_NAME}"
          )
        }
      }
    }
  }
}
