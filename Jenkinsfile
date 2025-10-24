pipeline {
    agent { label 'eyoree' }
    options {
        quietPeriod(0);
        copyArtifactPermission('/iossifovlab/*,/seqpipe/*');
        disableConcurrentBuilds()
    }
    environment {
        COMPOSE_PROJECT_NAME = "gpfwa-${env.BRANCH_NAME}-${env.BUILD_NUMBER}"
    }

    triggers {
        upstream(upstreamProjects: 'iossifovlab/gpf-conda-packaging/master', threshold: hudson.model.Result.SUCCESS)
    }

    stages {
        stage('Start') {
            steps {
                sh "echo 'Starting build ${COMPOSE_PROJECT_NAME}'"
                sh "docker run --rm -v .:/wd --entrypoint '/usr/bin/bash' ubuntu:24.04 -c 'rm -rf /wd/results'"
                sh "rm -rf conda-channel"

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
                sh "docker compose -f compose-jenkins.yaml build ubuntu-image"
                sh "docker compose -f compose-jenkins.yaml build gpf-image"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
            }
        }

        stage('Run Backend Linters') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build backend-linters"
                sh "docker compose -f compose-jenkins.yaml run  --rm --remove-orphans backend-linters || true"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "cp -r backend/results/* results/ || true"
            }
        }

        stage('Run Backend Tests') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build backend-tests"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run --rm --remove-orphans backend-tests || true"
                sh "cp -r backend/results/* results/ || true"
            }
        }

        stage('Run Frontend Linters') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build frontend-linters"
                sh "mkdir -p frontend/reports"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run --rm --remove-orphans frontend-linters || true"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
            }
        }

        stage('Run Frontend Tests') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build backend-tests"
                sh "mkdir -p frontend/reports"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run --rm --remove-orphans frontend-tests || true"
            }
        }

        stage('Build Backend image') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build backend"
            }
        }

        stage('Build Frontend image') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build frontend"
            }
        }

        stage('Run E2E Tests') {
            steps {
                sh "docker compose -f compose-jenkins.yaml build e2e-tests"
                sh "mkdir -p e2e-tests/reports"
                sh "docker compose -f compose-jenkins.yaml down --remove-orphans"
                sh "docker compose -f compose-jenkins.yaml run --rm --remove-orphans e2e-tests || true"
            }
        }


    }

  post {
    always {
      script {
        sh "docker compose -f compose-jenkins.yaml down --remove-orphans"


        try {

            archiveArtifacts artifacts: 'e2e-tests/reports/**', fingerprint: false, allowEmptyArchive: true

            discoverGitReferenceBuild(latestBuildIfNotFound: true, maxCommits: 400, skipUnknownCommits: true)

            def resultBeforeTests = currentBuild.currentResult
            junit 'results/backend-tests-junit.xml'
            sh "test ${resultBeforeTests} == ${currentBuild.currentResult}"
            junit 'frontend/reports/junit-report.xml'
            sh "test ${resultBeforeTests} == ${currentBuild.currentResult}"
            junit 'e2e-tests/reports/junit-report.xml'
            sh "test ${resultBeforeTests} == ${currentBuild.currentResult}"


            recordCoverage sourceCodeEncoding: 'UTF-8',
                enabledForFailure: false,
                sourceCodeRetention: 'LAST_BUILD',
                tools: [
                    [parser: 'COBERTURA', pattern: 'results/backend-coverage.xml']
                ]
            recordCoverage sourceCodeEncoding: 'UTF-8',
                enabledForFailure: false,
                sourceCodeRetention: 'LAST_BUILD',
                tools: [
                    [parser: 'COBERTURA', pattern: 'frontend/reports/coverage/cobertura-coverage.xml']
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
                reportName: 'backend-coverage',
                reportTitles: 'Backend Coverage'])

            publishHTML (target : [allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'frontend/reports/coverage/',
                reportFiles: 'index.html',
                reportName: 'frontend-coverage',
                reportTitles: 'Frontend Coverage'])


        } finally {
          zulipNotification(
            topic: "${env.JOB_NAME}"
          )
        }
      }
    }
  }
}
