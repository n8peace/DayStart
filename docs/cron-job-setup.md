# DayStart Cron Job Setup for cron-job.org

## 🎯 Overview

This document provides the exact setup instructions for configuring cron jobs on cron-job.org for both main (production) and develop environments.

## 🔧 Prerequisites

### **Required Information**
- **Supabase Project URL**: `https://your-project.supabase.co` (main) or `https://your-project-dev.supabase.co` (develop)
- **Service Role Key**: From Supabase Dashboard > Settings > API > Project API keys > service_role
- **Function URLs**: All edge function endpoints

### **cron-job.org Account Setup**
1. Create account at [cron-job.org](https://cron-job.org)
2. Verify email address
3. Note your account limits (free tier: 5 jobs, paid: unlimited)

## 📋 Main Environment Setup (Production)

### **1. generate-script**
- **URL**: `https://your-project.supabase.co/functions/v1/generate-script`
- **Schedule**: `* * * * *` (Every minute)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 60 seconds
- **Retry**: 3 attempts, 2-minute intervals

### **2. generate-audio**
- **URL**: `https://your-project.supabase.co/functions/v1/generate-audio`
- **Schedule**: `* * * * *` (Every minute)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 60 seconds
- **Retry**: 3 attempts, 2-minute intervals

### **3. generate-headlines-content**
- **URL**: `https://your-project.supabase.co/functions/v1/generate-headlines-content`
- **Schedule**: `0 */6 * * *` (Every 6 hours at minute 0)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **4. generate-encouragement-content**
- **URL**: `https://your-project.supabase.co/functions/v1/generate-encouragement-content`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **5. generate-sports-content**
- **URL**: `https://your-project.supabase.co/functions/v1/generate-sports-content`
- **Schedule**: `0 */12 * * *` (Every 12 hours at minute 0)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **6. generate-markets-content**
- **URL**: `https://your-project.supabase.co/functions/v1/generate-markets-content`
- **Schedule**: `0 */6 * * *` (Every 6 hours at minute 0)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **7. generate-wake-up-content**
- **URL**: `https://your-project.supabase.co/functions/v1/generate-wake-up-content`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **8. expiration-clean-up**
- **URL**: `https://your-project.supabase.co/functions/v1/expiration-clean-up`
- **Schedule**: `0 3 * * *` (Daily at 3:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **9. health-check**
- **URL**: `https://your-project.supabase.co/functions/v1/health-check`
- **Schedule**: `0 * * * *` (Every hour at minute 0)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 5-minute intervals

## 📋 Develop Environment Setup (Testing)

### **1. generate-script**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/generate-script`
- **Schedule**: `0 * * * *` (Every hour at minute 0)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 60 seconds
- **Retry**: 3 attempts, 5-minute intervals

### **2. generate-audio**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/generate-audio`
- **Schedule**: `0 * * * *` (Every hour at minute 0)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 60 seconds
- **Retry**: 3 attempts, 5-minute intervals

### **3. generate-headlines-content**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/generate-headlines-content`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **4. generate-encouragement-content**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/generate-encouragement-content`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 5-minute intervals

### **5. generate-sports-content**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/generate-sports-content`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **6. generate-markets-content**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/generate-markets-content`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 10-minute intervals

### **7. generate-wake-up-content**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/generate-wake-up-content`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 5-minute intervals

### **8. expiration-clean-up**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/expiration-clean-up`
- **Schedule**: `0 3 * * *` (Daily at 3:00 AM UTC)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 5-minute intervals

### **9. health-check**
- **URL**: `https://your-project-dev.supabase.co/functions/v1/health-check`
- **Schedule**: `0 * * * *` (Every hour at minute 0)
- **Method**: POST
- **Headers**:
  ```
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  ```
- **Body**: `{}`
- **Timeout**: 30 seconds
- **Retry**: 2 attempts, 5-minute intervals

## 🔧 Step-by-Step Setup Instructions

### **1. Create cron-job.org Account**
1. Go to [cron-job.org](https://cron-job.org)
2. Click "Sign Up" and create account
3. Verify email address
4. Log in to dashboard

### **2. Get Supabase Credentials**
1. Go to Supabase Dashboard
2. Select your project (main or develop)
3. Go to Settings > API
4. Copy the Project URL and service_role key

### **3. Create Each Cron Job**
For each function above:

1. **Click "Create cronjob"**
2. **Basic Settings**:
   - **Title**: `DayStart - [function-name] - [environment]`
   - **URL**: Copy from the list above
   - **Schedule**: Copy from the list above
   - **Method**: POST

3. **Headers**:
   - Click "Add Header"
   - **Name**: `Authorization`
   - **Value**: `Bearer YOUR_SERVICE_ROLE_KEY`
   - Click "Add Header"
   - **Name**: `Content-Type`
   - **Value**: `application/json`

4. **Request Body**:
   - **Body**: `{}`

5. **Advanced Settings**:
   - **Timeout**: Set according to list above
   - **Retry**: Set according to list above
   - **Notifications**: Enable email notifications for failures

6. **Save**: Click "Create cronjob"

### **4. Test Each Job**
1. Click "Execute now" for each job
2. Check the execution log
3. Verify the function returns success response
4. Check Supabase logs for function execution

### **5. Monitor Setup**
1. Set up email notifications for job failures
2. Monitor execution logs for first 24 hours
3. Check health-check function for queue monitoring
4. Verify content generation pipeline is working

## 🚨 Important Notes

### **Security**
- **Never share your service role key**
- **Use different keys for main and develop**
- **Rotate keys periodically**
- **Monitor for unauthorized access**

### **Rate Limits**
- **cron-job.org free tier**: 5 jobs maximum
- **Consider paid plan** for full setup (9 jobs)
- **Monitor API usage** to avoid rate limits

### **Monitoring**
- **Enable email notifications** for all jobs
- **Check execution logs** regularly
- **Monitor health-check** for pipeline status
- **Set up alerts** for critical failures

### **Troubleshooting**
- **Check function logs** in Supabase Dashboard
- **Verify service role key** is correct
- **Test function manually** before setting up cron job
- **Check network connectivity** from cron-job.org

## 📊 Expected Results

### **Successful Execution**
```json
{
  "success": true,
  "message": "Function executed successfully",
  "processed_count": 5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **Queue Monitoring (health-check)**
```json
{
  "queue_depths": {
    "pending": 0,
    "content_ready": 5,
    "script_generated": 3,
    "ready": 25
  }
}
```

### **Failure Response**
```json
{
  "success": false,
  "error": "Function execution failed",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔄 Maintenance

### **Regular Tasks**
1. **Monitor execution logs** weekly
2. **Check health-check reports** daily
3. **Review API usage** monthly
4. **Update service role keys** quarterly

### **Scaling Considerations**
- **Increase frequencies** based on demand
- **Add more content types** as needed
- **Optimize batch sizes** for performance
- **Monitor costs** for API usage 