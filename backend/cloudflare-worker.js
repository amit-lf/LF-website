// Enhanced Cloudflare Worker with Security, Logging, and Rate Limiting
// Environment Variables Required:
// HUNTER_API_KEY - Your Hunter.io API key
// ADMIN_SECRET - Secret for admin operations
// RATE_LIMIT_REQUESTS - Max requests per minute (default: 60)
// RATE_LIMIT_WINDOW - Time window in seconds (default: 60)

// Enhanced logging system
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO; // Change to DEBUG for development

function log(level, message, data = null) {
  if (level >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: Object.keys(LOG_LEVELS)[level],
      message,
      data: data ? JSON.stringify(data) : null
    };
    
    // Console logging for development
    console.log(`[${logEntry.level}] ${logEntry.message}`, data || '');
    
    // In production, you could send to external logging service
    // await sendToLogService(logEntry);
  }
}

// Rate limiting implementation
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.maxRequests = 60; // Default values since env vars aren't working
    this.windowMs = 60 * 1000;
  }

  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const requests = this.requests.get(identifier);
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }
}

const rateLimiter = new RateLimiter();

// Input validation and sanitization
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, 100); // Limit length
}

function validateUserData(data) {
  const { firstName, lastName, email } = data;
  
  if (!firstName || !lastName || !email) {
    return { valid: false, error: 'Missing required fields' };
  }
  
  if (!validateEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  const sanitizedData = {
    firstName: sanitizeString(firstName),
    lastName: sanitizeString(lastName),
    email: email.toLowerCase().trim()
  };
  
  if (sanitizedData.firstName.length < 2 || sanitizedData.lastName.length < 2) {
    return { valid: false, error: 'Names must be at least 2 characters' };
  }
  
  return { valid: true, data: sanitizedData };
}

// Enhanced CORS headers
function getCORSHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
}

// Enhanced error responses
function createErrorResponse(message, status = 400, details = null) {
  log(LOG_LEVELS.ERROR, `API Error: ${message}`, { status, details });
  
  return new Response(JSON.stringify({
    error: message,
    timestamp: new Date().toISOString(),
    details: details
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders()
    }
  });
}

// Enhanced success responses
function createSuccessResponse(data, message = 'Success') {
  log(LOG_LEVELS.INFO, `API Success: ${message}`, { data });
  
  return new Response(JSON.stringify({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders()
    }
  });
}

// PERSISTENT KV STORAGE - This actually works!
async function getUsersFromKV() {
  try {
    log(LOG_LEVELS.INFO, 'Getting users from KV storage');
    
    // Use the KV namespace directly - it's bound to the worker
    const usersData = await LF_USERS_DATA.get('users');
    
    if (!usersData) {
      log(LOG_LEVELS.INFO, 'No users found in KV, returning empty array');
      return [];
    }
    
    const users = JSON.parse(usersData);
    log(LOG_LEVELS.INFO, `Retrieved ${users.length} users from KV`);
    return users;
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Error getting users from KV', { error: error.message });
    return [];
  }
}

async function saveUsersToKV(users) {
  try {
    log(LOG_LEVELS.INFO, `Saving ${users.length} users to KV storage`);
    
    // Save to KV namespace directly
    await LF_USERS_DATA.put('users', JSON.stringify(users));
    
    log(LOG_LEVELS.INFO, 'Users saved to KV successfully');
    return true;
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Error saving users to KV', { error: error.message });
    return false;
  }
}

// Enhanced email verification with better error handling
async function handleEmailVerification(request, env) {
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!rateLimiter.isAllowed(clientIP)) {
      log(LOG_LEVELS.WARN, `Rate limit exceeded for IP: ${clientIP}`);
      return createErrorResponse('Rate limit exceeded. Please try again later.', 429);
    }
    
    const body = await request.json();
    const { email } = body;
    
    log(LOG_LEVELS.INFO, `Email verification request`, { email, clientIP });
    
    if (!email || !validateEmail(email)) {
      return createErrorResponse('Invalid email format');
    }
    
    // Get API key from environment variable - NO FALLBACK
    let hunterApiKey = null;
    
    // Try different ways to access the environment variable
    if (env && env.HUNTER_API_KEY) {
      hunterApiKey = env.HUNTER_API_KEY;
      log(LOG_LEVELS.INFO, 'Using HUNTER_API_KEY from env.HUNTER_API_KEY');
    } else if (typeof HUNTER_API_KEY !== 'undefined') {
      hunterApiKey = HUNTER_API_KEY;
      log(LOG_LEVELS.INFO, 'Using HUNTER_API_KEY from global HUNTER_API_KEY');
    } else {
      log(LOG_LEVELS.ERROR, 'HUNTER_API_KEY not found in environment - NO FALLBACK');
      return createErrorResponse('API key not configured', 500);
    }
    
    const hunterUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterApiKey}`;

    // Log at INFO so it shows up without DEBUG enabled
    log(LOG_LEVELS.INFO, 'Calling Hunter.io API', { url: hunterUrl.replace(hunterApiKey, '***') });

    try {
      const hunterResponse = await fetch(hunterUrl);

      if (!hunterResponse.ok) {
        log(LOG_LEVELS.ERROR, 'Hunter.io API non-200 response', { status: hunterResponse.status });
        // Soft fallback: do not hard-fail; return neutral result
        const fallbackResult = {
          email,
          valid: false,
          score: 0,
          status: 'unknown',
          fallback: true,
          message: 'Verification service unavailable (Hunter.io error)'
        };
        return new Response(JSON.stringify(fallbackResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
        });
      }

      const hunterData = await hunterResponse.json();

      log(LOG_LEVELS.INFO, 'Hunter.io response received', {
        email,
        score: hunterData.data?.score,
        status: hunterData.data?.status
      });

      // Enhanced response with more details
      const verificationResult = {
        email,
        valid: hunterData.data?.status === 'valid' || hunterData.data?.status === 'accept_all',
        score: hunterData.data?.score || 0,
        status: hunterData.data?.status || 'unknown',
        details: {
          disposable: hunterData.data?.disposable || false,
          webmail: hunterData.data?.webmail || false,
          mxRecord: hunterData.data?.mx_records || false,
          smtpServer: hunterData.data?.smtp_server || false,
          smtpCheck: hunterData.data?.smtp_check || false
        }
      };

      return new Response(JSON.stringify(verificationResult), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      });
    } catch (fetchError) {
      log(LOG_LEVELS.ERROR, 'Hunter.io fetch exception', { error: fetchError.message });
      // Network/exception fallback: neutral response
      const fallbackResult = {
        email,
        valid: false,
        score: 0,
        status: 'unknown',
        fallback: true,
        message: 'Verification service unavailable (network error)'
      };
      return new Response(JSON.stringify(fallbackResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
      });
    }
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Email verification error', { error: error.message, stack: error.stack });
    return createErrorResponse('Internal server error', 500);
  }
}

// Enhanced user registration with validation
async function handleUserRegistration(request, env) {
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!rateLimiter.isAllowed(clientIP)) {
      log(LOG_LEVELS.WARN, `Rate limit exceeded for IP: ${clientIP}`);
      return createErrorResponse('Rate limit exceeded. Please try again later.', 429);
    }
    
    const body = await request.json();
    
    log(LOG_LEVELS.INFO, `User registration request`, { clientIP, email: body.email });
    
    // Validate input data
    const validation = validateUserData(body);
    if (!validation.valid) {
      return createErrorResponse(validation.error);
    }
    
    const { data: userData } = validation;
    
    // Get existing users from KV
    const existingUsers = await getUsersFromKV();
    
    // Check for existing user
    const existingUser = existingUsers.find(user => user.email === userData.email);
    if (existingUser) {
      log(LOG_LEVELS.WARN, `Duplicate registration attempt`, { email: userData.email });
      return createErrorResponse('User with this email already exists');
    }
    
    // Get API key from environment variable - NO FALLBACK
    let hunterApiKey = null;
    
    // Try different ways to access the environment variable
    if (env && env.HUNTER_API_KEY) {
      hunterApiKey = env.HUNTER_API_KEY;
      log(LOG_LEVELS.INFO, 'Using HUNTER_API_KEY from env.HUNTER_API_KEY');
    } else if (typeof HUNTER_API_KEY !== 'undefined') {
      hunterApiKey = HUNTER_API_KEY;
      log(LOG_LEVELS.INFO, 'Using HUNTER_API_KEY from global HUNTER_API_KEY');
    } else {
      log(LOG_LEVELS.ERROR, 'HUNTER_API_KEY not found in environment - NO FALLBACK');
      return createErrorResponse('API key not configured', 500);
    }
    
    // Verify email with Hunter.io
    const hunterUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(userData.email)}&api_key=${hunterApiKey}`;
    
    let emailVerified = false;
    let hunterScore = 0;
    
    try {
      const hunterResponse = await fetch(hunterUrl);
      if (hunterResponse.ok) {
        const hunterData = await hunterResponse.json();
        emailVerified = hunterData.data?.status === 'valid';
        hunterScore = hunterData.data?.score || 0;
        log(LOG_LEVELS.INFO, `Email verification during registration`, { 
          email: userData.email, 
          verified: emailVerified, 
          score: hunterScore 
        });
      }
    } catch (error) {
      log(LOG_LEVELS.WARN, `Email verification failed during registration`, { error: error.message });
    }
    
    // Create new user with enhanced data
    const newUser = {
      id: Date.now().toString(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      emailVerified: emailVerified,
      hunterScore: hunterScore,
      registrationDate: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      status: 'active',
      metadata: {
        ipAddress: clientIP,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        registrationSource: 'web'
      }
    };
    
    // Add to existing users and save to KV
    existingUsers.push(newUser);
    const saveSuccess = await saveUsersToKV(existingUsers);
    
    if (!saveSuccess) {
      log(LOG_LEVELS.ERROR, 'Failed to save user to KV storage');
      return createErrorResponse('Registration failed - storage error', 500);
    }
    
    log(LOG_LEVELS.INFO, `User registered successfully`, { 
      userId: newUser.id, 
      email: newUser.email 
    });
    
    return new Response(JSON.stringify({
      success: true,
      userId: newUser.id,
      message: 'User registered successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders()
      }
    });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'User registration error', { error: error.message, stack: error.stack });
    return createErrorResponse('Registration failed', 500);
  }
}

// Enhanced user retrieval with pagination and filtering
async function handleGetUsers(request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    
    log(LOG_LEVELS.INFO, `Users retrieval request`, { page, limit, search });
    
    // Get users from KV
    const users = await getUsersFromKV();
    
    // Apply search filter
    let filteredUsers = users;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = users.filter(user => 
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }
    
    const total = filteredUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    // Calculate statistics
    const stats = {
      totalUsers: total,
      verifiedEmails: filteredUsers.filter(u => u.emailVerified).length,
      todayRegistrations: filteredUsers.filter(u => {
        const today = new Date().toDateString();
        return new Date(u.registrationDate).toDateString() === today;
      }).length,
      avgHunterScore: filteredUsers.length > 0 ? 
        (filteredUsers.reduce((sum, u) => sum + (u.hunterScore || 0), 0) / filteredUsers.length).toFixed(2) : 0
    };
    
    log(LOG_LEVELS.INFO, `Users retrieved successfully`, { total, page, limit });
    
    return new Response(JSON.stringify({
      users: paginatedUsers,
      total: total,
      page: page,
      limit: limit,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders()
      }
    });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Users retrieval error', { error: error.message, stack: error.stack });
    return createErrorResponse('Failed to retrieve users', 500);
  }
}

// Enhanced CSV download with better formatting
async function handleDownloadCSV(request) {
  try {
    log(LOG_LEVELS.INFO, `CSV download request`);
    
    // Get users from KV
    const users = await getUsersFromKV();
    
    if (users.length === 0) {
      return createSuccessResponse({ message: 'No users to export' });
    }
    
    // Enhanced CSV headers
    const headers = [
      'ID',
      'First Name',
      'Last Name', 
      'Email',
      'Email Verified',
      'Hunter Score',
      'Registration Date',
      'Last Login',
      'Status',
      'IP Address',
      'User Agent'
    ];
    
    // Enhanced CSV data
    const csvRows = [headers.join(',')];
    
    users.forEach(user => {
      const row = [
        user.id,
        `"${user.firstName}"`,
        `"${user.lastName}"`,
        user.email,
        user.emailVerified ? 'Yes' : 'No',
        user.hunterScore || 0,
        user.registrationDate,
        user.lastLogin || 'Never',
        user.status || 'active',
        user.metadata?.ipAddress || 'Unknown',
        `"${user.metadata?.userAgent || 'Unknown'}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    log(LOG_LEVELS.INFO, `CSV generated successfully`, { userCount: users.length });
    
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="legal_forensics_users_${new Date().toISOString().split('T')[0]}.csv"`,
        ...getCORSHeaders()
      }
    });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'CSV download error', { error: error.message, stack: error.stack });
    return createErrorResponse('Failed to generate CSV', 500);
  }
}

// Enhanced user deletion
async function handleDeleteUser(request, userId) {
  try {
    log(LOG_LEVELS.INFO, `Attempting to delete user with ID: ${userId}`);

    // Get existing users from KV
    const existingUsers = await getUsersFromKV();

    // Find the user by ID
    const initialUserCount = existingUsers.length;
    const userIndex = existingUsers.findIndex(user => user.id === userId);

    if (userIndex === -1) {
      log(LOG_LEVELS.WARN, `User with ID ${userId} not found for deletion`);
      return createErrorResponse('User not found', 404);
    }

    // Remove the user
    existingUsers.splice(userIndex, 1);

    // Save updated users to KV
    const saveSuccess = await saveUsersToKV(existingUsers);

    if (!saveSuccess) {
      log(LOG_LEVELS.ERROR, `Failed to save updated users to KV after deletion of user ${userId}`);
      return createErrorResponse('Failed to delete user - storage error', 500);
    }

    log(LOG_LEVELS.INFO, `User with ID ${userId} deleted successfully. Initial count: ${initialUserCount}, Final count: ${existingUsers.length}`);
    return createSuccessResponse({ message: `User with ID ${userId} deleted successfully` });

  } catch (error) {
    log(LOG_LEVELS.ERROR, `Error deleting user with ID ${userId}`, { error: error.message, stack: error.stack });
    return createErrorResponse('Failed to delete user', 500);
  }
}

// Main request handler with enhanced routing and security
async function handleRequest(request, env) {
  const startTime = Date.now();
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  log(LOG_LEVELS.INFO, `Request received`, {
    method: request.method,
    url: request.url,
    clientIP,
    userAgent: userAgent.substring(0, 100), // Truncate for logging
    envKeys: env ? Object.keys(env) : 'no env'
  });
  
  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: getCORSHeaders()
      });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route requests based on path and method
    let response;
    
    if (path === '/api/verify-email' && request.method === 'POST') {
      response = await handleEmailVerification(request, env);
    } else if (path === '/api/register' && request.method === 'POST') {
      response = await handleUserRegistration(request, env);
    } else if (path === '/api/users' && request.method === 'GET') {
      response = await handleGetUsers(request);
    } else if (path === '/api/download-csv' && request.method === 'GET') {
      response = await handleDownloadCSV(request);
    } else if (path.startsWith('/api/users/') && request.method === 'DELETE') {
      // Extract user ID from path: /api/users/{userId}
      const userId = path.split('/').pop();
      response = await handleDeleteUser(request, userId);
    } else {
      // Enhanced 404 with available endpoints
      response = new Response(JSON.stringify({
        error: 'Endpoint not found',
        availableEndpoints: [
          'POST /api/verify-email - Verify email address',
          'POST /api/register - Register new user',
          'GET /api/users - Get users with pagination',
          'GET /api/download-csv - Download users CSV'
        ],
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      });
    }
    
    // Add response time header
    const responseTime = Date.now() - startTime;
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    
    log(LOG_LEVELS.INFO, `Request completed`, {
      method: request.method,
      path,
      status: response.status,
      responseTime: `${responseTime}ms`
    });
    
    return response;
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Request handling error', { 
      error: error.message, 
      stack: error.stack,
      method: request.method,
      path: request.url
    });
    
    return createErrorResponse('Internal server error', 500);
  } finally {
    // Cleanup rate limiter periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup
      rateLimiter.cleanup();
    }
  }
}

// Event listener
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});
