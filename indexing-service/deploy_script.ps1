$ErrorActionPreference = "Stop"

$GCP_PROJECT="keen-scion-475112-c5"
$GCP_REGION="asia-south2"
$SERVICE_NAME="resume-parser-service"
$SERVICE_ACCOUNT_EMAIL="resume-parser-sa@keen-scion-475112-c5.iam.gserviceaccount.com"
$DB_CONNECTION_NAME="keen-scion-475112-c5:asia-south2:metvy-intelligence-resume-db"
$DOC_AI_LOCATION="eu"
$DOC_AI_OCR_PROCESSOR_ID="3b340b40079d7716"

gcloud run deploy $SERVICE_NAME `
    --project=$GCP_PROJECT `
    --region=$GCP_REGION `
    --source=. `
    --platform=managed `
    --service-account=$SERVICE_ACCOUNT_EMAIL `
    --port=8080 `
    --timeout=900s `
    --concurrency=8 `
    --max-instances=10 `
    --cpu=1 `
    --memory=1Gi `
    --ingress=internal `
    --no-allow-unauthenticated `
    --add-cloudsql-instances=$DB_CONNECTION_NAME `
    --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT,GCP_REGION=$GCP_REGION,DB_CONNECTION_NAME=$DB_CONNECTION_NAME,DOC_AI_LOCATION=$DOC_AI_LOCATION,DOC_AI_OCR_PROCESSOR_ID=$DOC_AI_OCR_PROCESSOR_ID,LOG_LEVEL=INFO" `
    --set-secrets="DB_USER=DB_USER:latest,DB_PASS=DB_PASS:latest,DB_NAME=DB_NAME:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,DB_HOST=DB_HOST:latest"
