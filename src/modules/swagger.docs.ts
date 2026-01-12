/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and authorization endpoints
 *   - name: Chatbot
 *     description: AI-powered negotiation chatbot
 *   - name: Bid Comparison
 *     description: Multi-vendor bid comparison and selection
 *   - name: Vector
 *     description: Vector search and RAG operations
 *   - name: Requisition
 *     description: Purchase requisition management
 *   - name: Contract
 *     description: Contract management
 *   - name: Vendor
 *     description: Vendor operations
 *   - name: Company
 *     description: Company management
 *   - name: User
 *     description: User management
 *   - name: Health
 *     description: Service health monitoring
 */

// ==================== AUTH ====================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */

// ==================== CHATBOT ====================

/**
 * @swagger
 * /api/chatbot/deals:
 *   post:
 *     summary: Create a new negotiation deal
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               requisitionId:
 *                 type: integer
 *               vendorId:
 *                 type: integer
 *               mode:
 *                 type: string
 *                 enum: [INSIGHTS, CONVERSATION]
 *                 default: INSIGHTS
 *     responses:
 *       201:
 *         description: Deal created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Deal'
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: List all deals
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [NEGOTIATING, ACCEPTED, WALKED_AWAY, ESCALATED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of deals
 */

/**
 * @swagger
 * /api/chatbot/deals/{dealId}:
 *   get:
 *     summary: Get deal by ID
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deal details with messages
 *       404:
 *         description: Deal not found
 */

/**
 * @swagger
 * /api/chatbot/deals/{dealId}/messages:
 *   post:
 *     summary: Process vendor message (INSIGHTS mode)
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Vendor message with offer details
 *                 example: "I can offer $95 per unit with Net 30 payment terms"
 *     responses:
 *       200:
 *         description: Message processed with AI decision
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deal:
 *                   $ref: '#/components/schemas/Deal'
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 decision:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [ACCEPT, COUNTER, WALK_AWAY, ESCALATE, ASK_CLARIFY]
 *                     utilityScore:
 *                       type: number
 *                     counterOffer:
 *                       type: object
 */

/**
 * @swagger
 * /api/chatbot/deals/{dealId}/suggest-counters:
 *   post:
 *     summary: Generate AI-powered counter-offer suggestions
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Counter-offer suggestions by scenario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 HARD:
 *                   type: array
 *                   items:
 *                     type: string
 *                 MEDIUM:
 *                   type: array
 *                   items:
 *                     type: string
 *                 SOFT:
 *                   type: array
 *                   items:
 *                     type: string
 *                 WALK_AWAY:
 *                   type: array
 *                   items:
 *                     type: string
 */

/**
 * @swagger
 * /api/chatbot/deals/{dealId}/reset:
 *   post:
 *     summary: Reset deal state
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deal reset successfully
 */

// ==================== BID COMPARISON ====================

/**
 * @swagger
 * /api/bid-comparison/{requisitionId}:
 *   get:
 *     summary: Get comparison status for requisition
 *     tags: [Bid Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requisitionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comparison status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BidComparison'
 */

/**
 * @swagger
 * /api/bid-comparison/{requisitionId}/bids:
 *   get:
 *     summary: List all vendor bids for requisition
 *     tags: [Bid Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requisitionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of vendor bids
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VendorBid'
 */

/**
 * @swagger
 * /api/bid-comparison/{requisitionId}/generate:
 *   post:
 *     summary: Manually generate comparison report
 *     tags: [Bid Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requisitionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comparison generated
 *       400:
 *         description: No completed bids to compare
 */

/**
 * @swagger
 * /api/bid-comparison/{requisitionId}/pdf:
 *   get:
 *     summary: Download comparison PDF report
 *     tags: [Bid Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requisitionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: No comparison report exists
 */

/**
 * @swagger
 * /api/bid-comparison/{requisitionId}/select/{bidId}:
 *   post:
 *     summary: Select winning vendor
 *     tags: [Bid Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requisitionId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: bidId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Optional reason for selection
 *     responses:
 *       200:
 *         description: Vendor selected, PO created, notifications sent
 *       400:
 *         description: Invalid selection
 *       404:
 *         description: Bid not found
 */

/**
 * @swagger
 * /api/bid-comparison/{requisitionId}/selection:
 *   get:
 *     summary: Get selection details
 *     tags: [Bid Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requisitionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Selection details with audit trail
 *       404:
 *         description: No selection made yet
 */

// ==================== VECTOR ====================

/**
 * @swagger
 * /api/vector/search/messages:
 *   post:
 *     summary: Search similar negotiation messages
 *     tags: [Vector]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 example: "I can offer $95 with Net 30 terms"
 *               topK:
 *                 type: integer
 *                 default: 5
 *               filters:
 *                 type: object
 *                 properties:
 *                   role:
 *                     type: string
 *                     enum: [VENDOR, ACCORDO]
 *                   decisionAction:
 *                     type: string
 *     responses:
 *       200:
 *         description: Similar messages found
 */

/**
 * @swagger
 * /api/vector/rag/{dealId}:
 *   post:
 *     summary: Get RAG context for deal
 *     tags: [Vector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: RAG context for LLM prompt augmentation
 */

/**
 * @swagger
 * /api/vector/health:
 *   get:
 *     summary: Check embedding service health
 *     tags: [Vector]
 *     responses:
 *       200:
 *         description: Embedding service status
 */

// ==================== REQUISITION ====================

/**
 * @swagger
 * /api/requisition:
 *   get:
 *     summary: List requisitions
 *     tags: [Requisition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of requisitions
 *   post:
 *     summary: Create requisition
 *     tags: [Requisition]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - projectId
 *             properties:
 *               title:
 *                 type: string
 *               projectId:
 *                 type: integer
 *               description:
 *                 type: string
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Requisition created
 */

/**
 * @swagger
 * /api/requisition/{id}:
 *   get:
 *     summary: Get requisition by ID
 *     tags: [Requisition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Requisition details
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update requisition
 *     tags: [Requisition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     summary: Delete requisition
 *     tags: [Requisition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Deleted
 */

// ==================== CONTRACT ====================

/**
 * @swagger
 * /api/contract:
 *   get:
 *     summary: List contracts
 *     tags: [Contract]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of contracts
 *   post:
 *     summary: Create contract (attach vendor to requisition)
 *     tags: [Contract]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requisitionId
 *               - vendorId
 *             properties:
 *               requisitionId:
 *                 type: integer
 *               vendorId:
 *                 type: integer
 *               skipEmail:
 *                 type: boolean
 *                 description: Skip sending notification email
 *               skipChatbot:
 *                 type: boolean
 *                 description: Skip creating chatbot deal
 *     responses:
 *       201:
 *         description: Contract created, vendor notified
 */

// ==================== VENDOR ====================

/**
 * @swagger
 * /api/vendor:
 *   get:
 *     summary: List vendors
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vendors
 *   post:
 *     summary: Create vendor
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Vendor created
 */

// ==================== COMPANY ====================

/**
 * @swagger
 * /api/company:
 *   get:
 *     summary: List companies
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of companies
 *   post:
 *     summary: Create company
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Company created
 */

// ==================== USER ====================

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: List users
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */

/**
 * @swagger
 * /api/user/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User details
 */

export {};
