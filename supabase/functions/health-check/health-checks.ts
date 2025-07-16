import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical'
  component: string
  message: string
  metrics?: Record<string, any>
  timestamp: string
}

export interface HealthReport {
  overall_status: 'healthy' | 'warning' | 'critical'
  checks: HealthCheckResult[]
  summary: {
    total_checks: number
    healthy_count: number
    warning_count: number
    critical_count: number
  }
  recommendations: string[]
  timestamp: string
}

// Health check functions
async function checkDatabaseConnectivity(supabaseClient: any): Promise<HealthCheckResult> {
  try {
    // Test basic database connectivity
    const { data, error } = await supabaseClient
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      return {
        status: 'critical',
        component: 'database_connectivity',
        message: `Database connection failed: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }

    return {
      status: 'healthy',
      component: 'database_connectivity',
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'critical',
      component: 'database_connectivity',
      message: `Database connectivity check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function checkContentPipeline(supabaseClient: any): Promise<HealthCheckResult> {
  try {
    // Get content block status distribution
    const { data: statusCounts, error } = await supabaseClient
      .from('content_blocks')
      .select('status')
    
    if (error) {
      return {
        status: 'critical',
        component: 'content_pipeline',
        message: `Failed to query content blocks: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }

    // Count statuses
    const statusDistribution = statusCounts.reduce((acc: any, block: any) => {
      acc[block.status] = (acc[block.status] || 0) + 1
      return acc
    }, {})

    // Queue depth monitoring for each pipeline stage
    const pendingCount = statusDistribution['pending'] || 0
    const contentReadyCount = statusDistribution['content_ready'] || 0
    const scriptGeneratedCount = statusDistribution['script_generated'] || 0
    const readyCount = statusDistribution['ready'] || 0

    // Check for stuck content (long-running states)
    const stuckThreshold = 100 // More than 100 items in processing states
    const stuckStates = ['script_generating', 'audio_generating', 'retry_pending']
    const stuckCount = stuckStates.reduce((total, status) => total + (statusDistribution[status] || 0), 0)

    // Check for high failure rates
    const failureStates = ['script_failed', 'audio_failed', 'content_failed', 'failed']
    const failureCount = failureStates.reduce((total, status) => total + (statusDistribution[status] || 0), 0)
    const totalContent = Object.values(statusDistribution).reduce((a: any, b: any) => a + b, 0)
    const failureRate = totalContent > 0 ? (failureCount / totalContent) * 100 : 0

    // Queue depth alert thresholds
    const warningThreshold = 20
    const criticalThreshold = 50
    const pipelineBlockageThreshold = {
      script: 100,
      audio: 20
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let message = 'Content pipeline operating normally'
    const metrics = {
      total_content_blocks: totalContent,
      status_distribution: statusDistribution,
      queue_depths: {
        pending: pendingCount,
        content_ready: contentReadyCount,
        script_generated: scriptGeneratedCount,
        ready: readyCount
      },
      stuck_count: stuckCount,
      failure_count: failureCount,
      failure_rate_percent: failureRate.toFixed(2)
    }

    // Check queue depths for warnings
    if (contentReadyCount > warningThreshold || scriptGeneratedCount > warningThreshold) {
      status = 'warning'
      message = `Queue depth warning: ${contentReadyCount} content_ready, ${scriptGeneratedCount} script_generated`
    }

    // Check queue depths for critical alerts
    if (contentReadyCount > criticalThreshold || scriptGeneratedCount > criticalThreshold) {
      status = 'critical'
      message = `Critical queue depth: ${contentReadyCount} content_ready, ${scriptGeneratedCount} script_generated`
    }

    // Check for pipeline blockage
    if (scriptGeneratedCount > pipelineBlockageThreshold.script) {
      status = 'critical'
      message = `Pipeline blockage detected: ${scriptGeneratedCount} items waiting for audio generation`
    }

    if (contentReadyCount > pipelineBlockageThreshold.script) {
      status = 'critical'
      message = `Pipeline blockage detected: ${contentReadyCount} items waiting for script generation`
    }

    // Check for stuck content
    if (stuckCount > stuckThreshold) {
      status = status === 'critical' ? 'critical' : 'warning'
      message = `High number of stuck content blocks: ${stuckCount}`
    }

    // Check for high failure rates
    if (failureRate > 10) { // More than 10% failure rate
      status = status === 'critical' ? 'critical' : 'warning'
      message = `High failure rate detected: ${failureRate.toFixed(1)}%`
    }

    if (failureRate > 20) { // More than 20% failure rate
      status = 'critical'
      message = `Critical failure rate: ${failureRate.toFixed(1)}%`
    }

    return {
      status,
      component: 'content_pipeline',
      message,
      metrics,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'critical',
      component: 'content_pipeline',
      message: `Content pipeline check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function checkRecentErrors(supabaseClient: any): Promise<HealthCheckResult> {
  try {
    // Get errors from the last 24 hours
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const { data: recentLogs, error } = await supabaseClient
      .from('logs')
      .select('*')
      .eq('status', 'error')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      return {
        status: 'critical',
        component: 'recent_errors',
        message: `Failed to query recent logs: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }

    const errorCount = recentLogs.length
    const errorTypes = recentLogs.reduce((acc: any, log: any) => {
      acc[log.event_type] = (acc[log.event_type] || 0) + 1
      return acc
    }, {})

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let message = 'No recent errors detected'

    if (errorCount > 50) {
      status = 'critical'
      message = `High error volume: ${errorCount} errors in last 24 hours`
    } else if (errorCount > 10) {
      status = 'warning'
      message = `Elevated error count: ${errorCount} errors in last 24 hours`
    }

    return {
      status,
      component: 'recent_errors',
      message,
      metrics: {
        error_count_24h: errorCount,
        error_types: errorTypes,
        recent_errors: recentLogs.slice(0, 5) // Top 5 most recent errors
      },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'critical',
      component: 'recent_errors',
      message: `Recent errors check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function checkExpiredContent(supabaseClient: any): Promise<HealthCheckResult> {
  try {
    // Check for content that should have been cleaned up
    const { data: expiredContent, error } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .lt('expiration_date', new Date().toISOString().split('T')[0])
      .not('status', 'expired')

    if (error) {
      return {
        status: 'critical',
        component: 'expired_content',
        message: `Failed to query expired content: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }

    const expiredCount = expiredContent.length
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let message = 'No expired content requiring cleanup'

    if (expiredCount > 100) {
      status = 'critical'
      message = `Large amount of expired content: ${expiredCount} items need cleanup`
    } else if (expiredCount > 20) {
      status = 'warning'
      message = `Expired content backlog: ${expiredCount} items need cleanup`
    }

    return {
      status,
      component: 'expired_content',
      message,
      metrics: {
        expired_count: expiredCount,
        expired_content_types: expiredContent.reduce((acc: any, content: any) => {
          acc[content.content_type] = (acc[content.content_type] || 0) + 1
          return acc
        }, {})
      },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'critical',
      component: 'expired_content',
      message: `Expired content check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function checkExternalAPIs(): Promise<HealthCheckResult> {
  const apiChecks = []
  const errors = []

  // Check OpenAI API (if configured)
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        signal: AbortSignal.timeout(5000)
      })
      apiChecks.push({ name: 'OpenAI', status: response.ok ? 'healthy' : 'error' })
      if (!response.ok) errors.push(`OpenAI API: ${response.status}`)
    } catch (error) {
      apiChecks.push({ name: 'OpenAI', status: 'error' })
      errors.push(`OpenAI API: ${error.message}`)
    }
  }

  // Check ElevenLabs API (if configured)
  const elevenLabsKey = Deno.env.get('ELEVEN_LABS_API_KEY')
  if (elevenLabsKey) {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': elevenLabsKey },
        signal: AbortSignal.timeout(5000)
      })
      apiChecks.push({ name: 'ElevenLabs', status: response.ok ? 'healthy' : 'error' })
      if (!response.ok) errors.push(`ElevenLabs API: ${response.status}`)
    } catch (error) {
      apiChecks.push({ name: 'ElevenLabs', status: 'error' })
      errors.push(`ElevenLabs API: ${error.message}`)
    }
  }

  // Check News API (if configured)
  const newsApiKey = Deno.env.get('NEWS_API_KEY')
  if (newsApiKey) {
    try {
      const response = await fetch(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${newsApiKey}&pageSize=1`, {
        signal: AbortSignal.timeout(5000)
      })
      apiChecks.push({ name: 'News API', status: response.ok ? 'healthy' : 'error' })
      if (!response.ok) errors.push(`News API: ${response.status}`)
    } catch (error) {
      apiChecks.push({ name: 'News API', status: 'error' })
      errors.push(`News API: ${error.message}`)
    }
  }

  const healthyAPIs = apiChecks.filter(check => check.status === 'healthy').length
  const totalAPIs = apiChecks.length

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  let message = 'All external APIs are healthy'

  if (totalAPIs === 0) {
    message = 'No external APIs configured'
  } else if (healthyAPIs === 0) {
    status = 'critical'
    message = 'All external APIs are failing'
  } else if (healthyAPIs < totalAPIs) {
    status = 'warning'
    message = `Some external APIs are failing: ${totalAPIs - healthyAPIs}/${totalAPIs}`
  }

  return {
    status,
    component: 'external_apis',
    message,
    metrics: {
      total_apis: totalAPIs,
      healthy_apis: healthyAPIs,
      api_status: apiChecks,
      errors: errors
    },
    timestamp: new Date().toISOString()
  }
}

async function checkUserActivity(supabaseClient: any): Promise<HealthCheckResult> {
  try {
    // Get user activity in the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentUsers, error } = await supabaseClient
      .from('users')
      .select('created_at, last_login')
      .gte('created_at', sevenDaysAgo.toISOString())

    if (error) {
      return {
        status: 'critical',
        component: 'user_activity',
        message: `Failed to query user activity: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }

    const newUsers = recentUsers.length
    const activeUsers = recentUsers.filter((user: any) => 
      user.last_login && new Date(user.last_login) >= sevenDaysAgo
    ).length

    return {
      status: 'healthy',
      component: 'user_activity',
      message: `User activity normal: ${newUsers} new users, ${activeUsers} active users in last 7 days`,
      metrics: {
        new_users_7d: newUsers,
        active_users_7d: activeUsers
      },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'critical',
      component: 'user_activity',
      message: `User activity check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

// Main function to run all health checks
export async function runHealthChecks(supabaseClient: any): Promise<HealthReport> {
  const checks = [
    await checkDatabaseConnectivity(supabaseClient),
    await checkContentPipeline(supabaseClient),
    await checkRecentErrors(supabaseClient),
    await checkExpiredContent(supabaseClient),
    await checkExternalAPIs(),
    await checkUserActivity(supabaseClient)
  ]

  // Calculate overall status
  const criticalCount = checks.filter(check => check.status === 'critical').length
  const warningCount = checks.filter(check => check.status === 'warning').length
  const healthyCount = checks.filter(check => check.status === 'healthy').length

  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (criticalCount > 0) {
    overallStatus = 'critical'
  } else if (warningCount > 0) {
    overallStatus = 'warning'
  }

  // Generate recommendations
  const recommendations: string[] = []
  
  if (criticalCount > 0) {
    recommendations.push('Immediate attention required for critical issues')
  }
  
  if (warningCount > 0) {
    recommendations.push('Monitor warning conditions closely')
  }

  const contentPipelineCheck = checks.find(check => check.component === 'content_pipeline')
  if (contentPipelineCheck?.metrics?.failure_rate_percent > 10) {
    recommendations.push('Investigate content generation failures')
  }

  const expiredContentCheck = checks.find(check => check.component === 'expired_content')
  if (expiredContentCheck?.metrics?.expired_count > 20) {
    recommendations.push('Run expiration cleanup function')
  }

  const recentErrorsCheck = checks.find(check => check.component === 'recent_errors')
  if (recentErrorsCheck?.metrics?.error_count_24h > 10) {
    recommendations.push('Review recent error logs for patterns')
  }

  return {
    overall_status: overallStatus,
    checks,
    summary: {
      total_checks: checks.length,
      healthy_count: healthyCount,
      warning_count: warningCount,
      critical_count: criticalCount
    },
    recommendations,
    timestamp: new Date().toISOString()
  }
} 