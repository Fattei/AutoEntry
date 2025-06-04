-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "company_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "file_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT,
    "upload_status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("file_id")
);

-- CreateTable
CREATE TABLE "DataProcessingJob" (
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_name" TEXT,
    "job_type" TEXT NOT NULL,
    "input_file_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "config" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataProcessingJob_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "ProcessingResult" (
    "result_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "result_type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingResult_pkey" PRIMARY KEY ("result_id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "log_id" SERIAL NOT NULL,
    "job_id" TEXT,
    "user_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT NOT NULL,
    "error_stack" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "context_data" JSONB,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FileUpload_user_id_idx" ON "FileUpload"("user_id");

-- CreateIndex
CREATE INDEX "DataProcessingJob_user_id_idx" ON "DataProcessingJob"("user_id");

-- CreateIndex
CREATE INDEX "DataProcessingJob_status_idx" ON "DataProcessingJob"("status");

-- CreateIndex
CREATE INDEX "DataProcessingJob_job_type_idx" ON "DataProcessingJob"("job_type");

-- CreateIndex
CREATE INDEX "DataProcessingJob_input_file_id_idx" ON "DataProcessingJob"("input_file_id");

-- CreateIndex
CREATE INDEX "ProcessingResult_job_id_idx" ON "ProcessingResult"("job_id");

-- CreateIndex
CREATE INDEX "ProcessingResult_user_id_idx" ON "ProcessingResult"("user_id");

-- CreateIndex
CREATE INDEX "ErrorLog_job_id_idx" ON "ErrorLog"("job_id");

-- CreateIndex
CREATE INDEX "ErrorLog_user_id_idx" ON "ErrorLog"("user_id");

-- CreateIndex
CREATE INDEX "ErrorLog_timestamp_idx" ON "ErrorLog"("timestamp");

-- CreateIndex
CREATE INDEX "ErrorLog_severity_idx" ON "ErrorLog"("severity");

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataProcessingJob" ADD CONSTRAINT "DataProcessingJob_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataProcessingJob" ADD CONSTRAINT "DataProcessingJob_input_file_id_fkey" FOREIGN KEY ("input_file_id") REFERENCES "FileUpload"("file_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingResult" ADD CONSTRAINT "ProcessingResult_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "DataProcessingJob"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingResult" ADD CONSTRAINT "ProcessingResult_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "DataProcessingJob"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
