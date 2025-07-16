# DayStart Cron Jobs Documentation

## 🎯 Overview

This document outlines the cron job scheduling strategy for DayStart's content generation pipeline across main (production) and develop environments.

## 📋 Function Scheduling Strategy

### **Main Environment (Production)**
Conservative scheduling focused on reliability and cost optimization.

| Function | Frequency | Schedule | Purpose | API Impact |
|----------|-----------|----------|---------|------------|
| `generate-script` | Every minute | `* * * * *` | Process content_ready → script_generated | OpenAI GPT-4o |
| `generate-audio` | Every minute | `* * * * *` | Process script_generated → ready | ElevenLabs |
| `generate-headlines-content` | Every 6 hours | `0 */6 * * *` | News headlines and summaries | News API, GNews |
| `generate-encouragement-content` | Daily | `0 2 * * *` | Motivational content (5 types) | None |
| `generate-sports-content` | Every 12 hours | `0 */12 * * *` | Sports updates and highlights | ESPN, SportsDB |
| `generate-markets-content` | Every 6 hours | `0 */6 * * *` | Market data and business news | Yahoo Finance, News API |
| `generate-wake-up-content` | Daily | `0 2 * * *` | Morning wake-up messages | Calendarific |
| `expiration-clean-up` | Daily | `0 3 * * *` | Clean up expired audio files | None |
| `health-check` | Hourly | `0 * * * *` | System monitoring and alerts | External APIs |

### **Develop Environment (Testing)**
Conservative scheduling for development and testing purposes.

| Function | Frequency | Schedule | Purpose | API Impact |
|----------|-----------|----------|---------|------------|
| `generate-script` | Hourly | `0 * * * *` | Process content_ready → script_generated | OpenAI GPT-4o |
| `generate-audio` | Hourly | `0 * * * *` | Process script_generated → ready | ElevenLabs |
| `generate-headlines-content` | Daily | `0 2 * * *` | News headlines and summaries | News API, GNews |
| `generate-encouragement-content` | Daily | `0 2 * * *` | Motivational content (5 types) | None |
| `generate-sports-content` | Daily | `0 2 * * *` | Sports updates and highlights | ESPN, SportsDB |
| `generate-markets-content` | Daily | `0 2 * * *` | Market data and business news | Yahoo Finance, News API |
| `generate-wake-up-content` | Daily | `0 2 * * *` | Morning wake-up messages | Calendarific |
| `expiration-clean-up` | Daily | `0 3 * * *` | Clean up expired audio files | None |
| `health-check` | Hourly | `0 * * * *` | System monitoring and alerts | External APIs |

## 🔄 Pipeline Flow

### **Content Generation Pipeline**
```mermaid
graph TD
    A[Content Functions] --> B[content_ready]
    B --> C[generate-script]
    C --> D[script_generated]
    D --> E[generate-audio]
    E --> F[ready]
    
    G[Cron Jobs] --> A
    H[Cron Jobs] --> C
    I[Cron Jobs] --> E
```

### **Processing Order**
1. **Content Functions** create `content_ready` records
2. **generate-script** processes `content_ready` → `script_generated`
3. **generate-audio** processes `script_generated` → `ready`
4. **expiration-clean-up** removes expired audio files
5. **health-check** monitors entire pipeline

## 📊 Queue Monitoring

### **Queue Depth Metrics**
The health-check function monitors queue depths for each pipeline stage:

- **Pending Content**: Records with `status = 'pending'`
- **Content Ready**: Records with `status = 'content_ready'`
- **Script Generated**: Records with `status = 'script_generated'`
- **Ready Content**: Records with `status = 'ready'`
- **Failed Content**: Records with `status = 'content_failed'`, `'script_failed'`, `'audio_failed'`

### **Alert Thresholds**
- **Warning**: Queue depth > 20 for any stage
- **Critical**: Queue depth > 50 for any stage
- **Pipeline Blockage**: Script queue > 100 or Audio queue > 20

## 🚨 Error Handling & Monitoring

### **Function-Specific Monitoring**
- **Content Functions**: Monitor API failures and content generation success rates
- **generate-script**: Monitor OpenAI API usage and script generation failures
- **generate-audio**: Monitor ElevenLabs API usage and audio generation failures
- **expiration-clean-up**: Monitor storage cleanup success rates

### **API Rate Limit Monitoring**
- **News API**: Alert at 80% of daily limit (80/100 requests)
- **GNews**: Alert at 80% of daily limit (80/100 requests)
- **OpenAI**: Monitor RPM and TPM usage
- **ElevenLabs**: Monitor concurrent request limits

## 🔧 Cron Job Setup

### **cron-job.org Configuration**

#### **Main Environment URLs**
```
https://your-project.supabase.co/functions/v1/generate-script
https://your-project.supabase.co/functions/v1/generate-audio
https://your-project.supabase.co/functions/v1/generate-headlines-content
https://your-project.supabase.co/functions/v1/generate-encouragement-content
https://your-project.supabase.co/functions/v1/generate-sports-content
https://your-project.supabase.co/functions/v1/generate-markets-content
https://your-project.supabase.co/functions/v1/generate-wake-up-content
https://your-project.supabase.co/functions/v1/expiration-clean-up
https://your-project.supabase.co/functions/v1/health-check
```

#### **Develop Environment URLs**
```
https://your-project-dev.supabase.co/functions/v1/generate-script
https://your-project-dev.supabase.co/functions/v1/generate-audio
https://your-project-dev.supabase.co/functions/v1/generate-headlines-content
https://your-project-dev.supabase.co/functions/v1/generate-encouragement-content
https://your-project-dev.supabase.co/functions/v1/generate-sports-content
https://your-project-dev.supabase.co/functions/v1/generate-markets-content
https://your-project-dev.supabase.co/functions/v1/generate-wake-up-content
https://your-project-dev.supabase.co/functions/v1/expiration-clean-up
https://your-project-dev.supabase.co/functions/v1/health-check
```

### **Request Headers**
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
```

### **Request Body**
```json
{}
```

## 📈 Performance Considerations

### **Batch Processing**
- **generate-script**: Processes up to 100 records per execution
- **generate-audio**: Processes up to 5 records per execution
- **Content functions**: Process all pending records of their type

### **Concurrency Limits**
- **ElevenLabs**: 5 concurrent requests maximum
- **OpenAI**: Varies by tier, typically 3-10 concurrent requests
- **Sequential processing**: Within batches to respect API limits

### **Function Timeouts**
- **Content functions**: 30 seconds
- **generate-script**: 60 seconds
- **generate-audio**: 60 seconds
- **health-check**: 30 seconds
- **expiration-clean-up**: 30 seconds

## 🔄 Environment-Specific Considerations

### **Main Environment**
- **Conservative scheduling** to minimize costs
- **Staggered execution** to avoid API conflicts
- **Comprehensive monitoring** for production reliability
- **Graceful degradation** when services are unavailable

### **Develop Environment**
- **Frequent execution** for development and testing
- **Rapid feedback** on pipeline issues
- **API usage monitoring** to prevent rate limit issues
- **Debug logging** for troubleshooting

## 🚀 Deployment Strategy

### **Phase 1: Develop Environment**
1. Deploy all cron jobs with develop frequencies
2. Monitor for 1 week
3. Adjust based on queue depths and API usage
4. Validate pipeline flow and error handling

### **Phase 2: Main Environment**
1. Deploy with conservative frequencies
2. Monitor closely for first 24 hours
3. Gradually increase frequencies based on performance
4. Implement alerting and monitoring

### **Phase 3: Optimization**
1. Implement smart skipping logic
2. Add adaptive scheduling based on queue depths
3. Optimize batch sizes and processing times
4. Fine-tune alert thresholds

## 📊 Success Metrics

### **Pipeline Health**
- **Queue depths** < 20 for all stages
- **Processing times** < 30 seconds for content functions
- **Error rates** < 5% for all functions
- **API usage** < 80% of daily limits

### **Content Quality**
- **Content freshness** < 6 hours for hourly functions
- **Audio generation success** > 95%
- **Script generation success** > 95%
- **User satisfaction** with content quality

### **System Reliability**
- **Uptime** > 99.9%
- **Function timeouts** < 1%
- **Storage cleanup** successful daily
- **Health check alerts** responded to within 1 hour 