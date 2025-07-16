# DayStart API Configuration

## 🔑 Required API Keys

### **Environment Variables**

```bash
# Supabase Configuration (auto-configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# External APIs
ABSTRACTS_API_KEY=your_abstracts_api_key
NEWS_API_KEY=your_news_api_key
GNEWS_API_KEY=your_gnews_api_key
SPORTSDB_API_KEY=your_sportsdb_api_key  # Optional, defaults to free key '123'
RAPID_API_KEY=your_rapid_api_key
```

## 📡 API Endpoints & Configuration

### **1. Abstracts API (Holidays)**
- **Endpoint**: `https://holidays.abstractapi.com/v1/`
- **Parameters**: `api_key`, `country=US`, `year`, `month`, `day`
- **Example**: `https://holidays.abstractapi.com/v1/?api_key=KEY&country=US&year=2025&month=12&day=25`
- **Used by**: `generate-wake-up-content`

### **2. News API**
- **Endpoint**: `https://newsapi.org/v2/top-headlines`
- **Parameters**: `country=us`, `apiKey`, `pageSize=5`
- **Example**: `https://newsapi.org/v2/top-headlines?country=us&apiKey=KEY&pageSize=5`
- **Used by**: `generate-headlines-content`

### **3. GNews API**
- **Endpoint**: `https://gnews.io/api/v4/top-headlines`
- **Parameters**: `category=general`, `country=us`, `token`, `max=5`
- **Example**: `https://gnews.io/api/v4/top-headlines?category=general&country=us&token=KEY&max=5`
- **Used by**: `generate-headlines-content`

### **4. SportsDB API**
- **Endpoint**: `https://www.thesportsdb.com/api/v1/json/{API_KEY}/eventsday.php`
- **Parameters**: `d={date}` (YYYY-MM-DD format)
- **Example**: `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=2025-01-15`
- **Free API Key**: `123` (30 requests/minute)
- **Used by**: `generate-sports-content`

### **5. ESPN API**
- **Endpoint**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- **Parameters**: None (public API)
- **Example**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- **Used by**: `generate-sports-content`

### **6. Yahoo Finance API (via Rapid API)**
- **Endpoint**: `https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-quotes`
- **Parameters**: `symbols=^GSPC,^DJI,^IXIC`, `region=US`
- **Headers**: `X-RapidAPI-Key`, `X-RapidAPI-Host: apidojo-yahoo-finance-v1.p.rapidapi.com`
- **Example**: `https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-quotes?symbols=^GSPC,^DJI,^IXIC&region=US`
- **Used by**: `generate-markets-content`

### **7. News API (Business Category)**
- **Endpoint**: `https://newsapi.org/v2/top-headlines`
- **Parameters**: `category=business`, `country=us`, `apiKey`, `pageSize=3`
- **Example**: `https://newsapi.org/v2/top-headlines?category=business&country=us&apiKey=KEY&pageSize=3`
- **Used by**: `generate-markets-content`

## 🔄 Rate Limits

### **SportsDB API**
- **Free**: 30 requests per minute
- **Premium**: 100 requests per minute
- **Business**: 120 requests per minute

### **Other APIs**
- **News API**: 100 requests per day (free tier)
- **GNews API**: 100 requests per day (free tier)
- **Abstracts API**: 1000 requests per month (free tier)
- **Rapid API**: Varies by plan

## 🚨 Error Handling

All functions include comprehensive error handling:
- **API failures** are logged to `logs` table
- **Partial failures** still result in `content_ready` status
- **Complete failures** result in `content_failed` status
- **Fallback content** includes "no data available" messages

## 📊 Data Processing

### **Content Generation Flow**
1. **Fetch API data** with error handling
2. **Log API calls** to `logs` table
3. **Extract key information** from responses
4. **Create text summaries** for AI script generation
5. **Store in content_blocks** with `content_ready` status
6. **Log successful generation** to `logs` table

### **Data Storage**
- **Raw API responses** stored in `parameters` JSONB field
- **Text summaries** stored in `content` field
- **Error information** stored in `parameters` for debugging
- **Previous content** stored for repetition avoidance

## 🔧 Deployment Notes

### **Environment Setup**
1. Set all required environment variables in Supabase dashboard
2. Deploy functions to Supabase edge functions
3. Test each function individually
4. Monitor logs table for API call results

### **Testing**
- Test with valid API keys
- Test with missing API keys (should use fallbacks)
- Test with invalid API keys (should handle gracefully)
- Monitor rate limits and adjust scheduling accordingly 