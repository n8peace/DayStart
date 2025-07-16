# DayStart Rate Limits Documentation

## 📊 Overview

This document tracks all rate limits for external APIs, Supabase services, and edge functions used in the DayStart application. **You're on the Supabase Pro plan.**

## 🔑 External APIs

### **1. OpenAI API (GPT-4o)**
- **Service**: OpenAI GPT-4o for script generation
- **Rate Limit**: 
  - **GPT-4o**: 5,000 requests per minute (RPM)
  - **Tokens**: 800,000 tokens per minute (TPM)
  - **Enterprise**: Custom limits
- **Used by**: `generate-script` function
- **Current Usage**: Script generation for all content types (~10-20 calls/day)
- **Status**: ✅ Well within limits (using ~0.03% of RPM capacity)
- **Monitoring**: Check OpenAI dashboard for usage

### **2. News API**
- **Service**: News headlines and business news
- **Rate Limit**: 
  - **Free Tier**: 100 requests per day
  - **Developer**: 1,000 requests per day ($449/month)
  - **Business**: Custom limits
- **Used by**: `generate-headlines-content`, `generate-markets-content`
- **Current Usage**: ~2 requests per day (headlines + business news)
- **Status**: ✅ Well within limits (using 2% of daily quota)

### **3. GNews API**
- **Service**: Alternative news headlines
- **Rate Limit**: 
  - **Free Tier**: 100 requests per day
  - **Basic**: 1,000 requests per day ($49/month)
  - **Standard**: 10,000 requests per day ($99/month)
- **Used by**: `generate-headlines-content`
- **Current Usage**: ~1 request per day
- **Status**: ✅ Well within limits (using 1% of daily quota)

### **4. Abstracts API (Holidays)**
- **Service**: Holiday data for wake-up content
- **Rate Limit**: 
  - **Free Tier**: 1,000 requests per month
  - **Basic**: 10,000 requests per month ($9.99/month)
  - **Standard**: 100,000 requests per month ($19.99/month)
- **Used by**: `generate-wake-up-content`
- **Current Usage**: ~1 request per day
- **Status**: ✅ Well within limits

### **5. ESPN API**
- **Service**: US sports data (NFL, NBA, MLB, NHL, NCAA)
- **Rate Limit**: 
  - **Public API**: No documented limits (use responsibly)
  - **Recommended**: < 100 requests per minute
- **Used by**: `generate-sports-content`
- **Current Usage**: ~6 requests per day (6 sports leagues)
- **Status**: ✅ Well within recommended limits

### **6. Rapid API (Yahoo Finance)**
- **Service**: Market data via Yahoo Finance
- **Rate Limit**: 
  - **Quota**: 10,000 objects per month
  - **Basic**: 5,000 requests per month ($25/month)
  - **Pro**: 50,000 requests per month ($100/month)
- **Used by**: `generate-markets-content`
- **Current Usage**: ~1 request per day (~30 objects/month)
- **Status**: ✅ Well within limits (using 0.3% of monthly quota)

## 🏗️ Supabase Services (Pro Plan)

### **Database Operations**
- **Rate Limit**: 100,000 requests per hour
- **Concurrent Connections**: 100
- **Storage**: 100 GB
- **Bandwidth**: 1 TB per month
- **Used by**: All functions for data storage and retrieval
- **Current Usage**: Minimal (content blocks, logs, user data)
- **Status**: ✅ Well within limits

### **Edge Functions**
- **Rate Limit**: 2,000,000 invocations per month
- **Execution Time**: 50 seconds max per function
- **Memory**: 150 MB per function
- **Used by**: All content generation functions
- **Current Usage**: ~10-20 invocations per day (~600/month)
- **Status**: ✅ Well within limits (using 0.03% of monthly quota)

### **Authentication**
- **Rate Limit**: 50,000 requests per hour
- **Used by**: User authentication (future feature)
- **Current Usage**: Minimal
- **Status**: ✅ Well within limits

### **Storage**
- **Rate Limit**: 100,000 requests per hour
- **Used by**: Audio file storage (future feature)
- **Current Usage**: Minimal
- **Status**: ✅ Well within limits

## ⚡ Edge Function Limits

### **Function-Specific Limits**
- **Execution Time**: 50 seconds maximum
- **Memory**: 150 MB per function
- **Request Size**: 6 MB maximum
- **Response Size**: 6 MB maximum

### **Current Function Usage**
| Function | Daily Calls | Avg Duration | Memory Usage |
|----------|-------------|--------------|--------------|
| `generate-wake-up-content` | ~1 | <5s | <50MB |
| `generate-headlines-content` | ~1 | <10s | <50MB |
| `generate-markets-content` | ~1 | <8s | <50MB |
| `generate-sports-content` | ~1 | <15s | <50MB |
| `generate-weather-content` | ~1 | <5s | <50MB |
| `generate-encouragement-content` | ~1 | <5s | <50MB |
| `generate-script` | ~10-20 | <30s | <100MB |

## 📈 Daily Usage Summary

### **External API Calls (Per Day)**
- **OpenAI**: 10-20 calls (script generation)
- **News API**: 2 calls (headlines + business)
- **GNews**: 1 call (backup headlines)
- **Abstracts**: 1 call (holidays)
- **ESPN**: 6 calls (6 sports leagues)
- **Rapid API**: 1 call (markets)
- **Total**: ~21-31 external API calls per day

### **Supabase Operations (Per Day)**
- **Database Reads**: ~50-100
- **Database Writes**: ~20-40
- **Function Invocations**: ~10-20
- **Storage Operations**: Minimal

## 🚨 Rate Limit Monitoring

### **Current Status**
✅ **All APIs well within limits**
✅ **Supabase Pro plan provides ample capacity**
✅ **Daily usage is minimal compared to limits**

### **Monitoring Recommendations**
1. **Set up alerts** for 80% usage on any API
2. **Monitor OpenAI usage** as it's the most expensive
3. **Track Supabase function invocations** monthly
4. **Watch ESPN API** for any rate limiting (unlikely)

### **Scaling Considerations**
- **Current usage**: ~30 API calls/day
- **10x scaling**: Still within all limits (300 calls/day)
- **100x scaling**: Still within most limits (3,000 calls/day)
- **1000x scaling**: Would hit News API and GNews limits (30,000 calls/day)
- **10,000x scaling**: Would need enterprise plans for all APIs

## 🔧 Optimization Strategies

### **Current Optimizations**
- **Batch processing**: Multiple sports in one function
- **Error handling**: Graceful degradation when APIs fail
- **Caching**: Content stored for 72 hours
- **Fallbacks**: Multiple news sources

### **Future Optimizations**
- **Implement caching** for frequently accessed data
- **Batch API calls** where possible
- **Use webhooks** instead of polling
- **Implement retry logic** with exponential backoff

## 📋 Action Items

### **Immediate**
- [ ] Set up monitoring alerts for 80% usage
- [ ] Document current usage patterns
- [ ] Review API costs monthly

### **Future**
- [ ] Implement caching layer
- [ ] Add retry logic for failed API calls
- [ ] Consider upgrading to paid tiers if usage increases

## 🔗 Resources

- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [News API Pricing](https://newsapi.org/pricing)
- [GNews API Pricing](https://gnews.io/pricing)
- [Abstracts API Pricing](https://www.abstractapi.com/api/holidays-api/pricing)
- [Rapid API Pricing](https://rapidapi.com/apidojo/api/yahoo-finance1)
- [Supabase Pro Limits](https://supabase.com/pricing)

---

**Last Updated**: January 2025  
**Next Review**: Monthly usage review 