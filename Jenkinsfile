pipeline {
  agent any
  options {
    copyArtifactPermission('/iossifovlab/*,/seqpipe/*');
    disableConcurrentBuilds()
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
        script {
          dir('backend/gpf') {
            checkout scmGit([
              branches: [[name: '*/master']],
              userRemoteConfigs: [[credentialsId: 'lubo_jenkins_42', url: 'git@github.com:iossifovlab/gpf.git']],
            ])
          }
        }
      }
    }

    stage('Build backend Docker image') {
      steps {
        sh "docker build -q . -t web_annotation_backend"
      }
    }

    stage('Run backend tests') {
      steps {
        sh "docker run --name web-annotation-backend-container web_annotation_backend"
        sh "docker cp web-annotation-backend-container:/wd/test-results ."
      }
    }

    stage('Cleanup') {
      steps {
        sh "docker rm web-annotation-backend-container"
      }
    }
  }
  post {
    always {
      script {
        try {
          def resultBeforeTests = currentBuild.currentResult
          junit 'test-results/backend-tests-junit.xml'
          sh "test ${resultBeforeTests} == ${currentBuild.currentResult}"

          publishHTML (target : [allowMissing: true,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: 'test-results/coverage-html',
            reportFiles: 'index.html',
            reportName: 'gpf-web-annotation-backend-coverage-report',
            reportTitles: 'GPF Web Annotation backend coverage report'])

        } finally {
          zulipNotification(
            topic: "${env.JOB_NAME}"
          )
        }
      }
    }
  }
}
