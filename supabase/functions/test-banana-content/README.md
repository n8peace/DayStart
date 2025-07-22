# Test Banana Content

A test function to verify the banana content generation works correctly with existing user data.

## Purpose

This function tests the `generate-banana-content` function by:
1. Finding a test user with complete data
2. Verifying all required data exists (preferences, weather, headlines, markets)
3. Calling the banana content function
4. Logging the results

## API Endpoint

```
GET /functions/v1/test-banana-content
```

## Response

Returns test results including:
- Success/failure status
- Test user ID
- Banana content function response
- User preferences
- Missing data indicators

## Test Requirements

The function checks for:
- At least one user in the database
- User preferences (name, city, state, voice)
- Today's headlines content
- Today's markets content  
- Today's weather data for the user

## Usage

Call this function to verify that:
1. The banana content generation pipeline works
2. All required data is available
3. The GPT-4o integration is functioning
4. Content blocks are created correctly

## Error Handling

Returns detailed error information if:
- No users exist
- User is missing preferences
- Required content is missing
- Banana content function fails

## Logging

Logs all test results to the `logs` table:
- `test_banana_content`: Test execution results
- `test_banana_content_exception`: Unexpected errors 