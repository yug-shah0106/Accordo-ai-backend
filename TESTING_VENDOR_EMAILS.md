# Testing Vendor Emails - Quick Guide

## ✅ Vendor Created Successfully

**Vendor Details:**
- **ID**: `14`
- **Name**: `vatsal s`
- **Email**: `vatsal.s@deuexsolutions.com`
- **User Type**: `vendor`
- **Status**: `active`
- **Password**: `Password@123`

---

## 📧 Email Configuration

**Sender (FROM)**: `yug.shah@deuexsolutions.com` (AWS SES verified)
**Recipient (TO)**: `vatsal.s@deuexsolutions.com` (the vendor)

---

## 🧪 How to Test Vendor Emails

### Option 1: Via Admin Panel (UI)

1. **Login to Admin Panel**
   - URL: `http://localhost:5001/admin` (or your frontend URL)
   - Login with your admin credentials

2. **Create a Requisition**
   - Navigate to Requisitions
   - Click "Create New Requisition"
   - Fill in requisition details (title, project, products, etc.)
   - Save the requisition

3. **Attach Vendor to Requisition**
   - Open the requisition you just created
   - Click "Add Vendor" or "Attach Vendor"
   - Select vendor: **vatsal s** (ID: 14)
   - Click "Attach" or "Save"

4. **Check Email**
   - An email will be automatically sent to `vatsal.s@deuexsolutions.com`
   - Email subject: "New Requisition Assignment: [Requisition Title]"
   - Email contains:
     - Requisition details
     - Products list with target prices
     - Vendor portal link
     - Chatbot negotiation link

---

### Option 2: Via API (Postman/cURL)

#### Step 1: Get an Existing Requisition

**Request:**
```bash
GET http://localhost:5002/api/requisition
Authorization: Bearer <your-jwt-token>
```

**Or create a new requisition:**
```bash
POST http://localhost:5002/api/requisition
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "subject": "Test Requisition for Email",
  "projectId": 1,
  "products": [
    {
      "productId": 1,
      "quantity": 10,
      "targetPrice": 100
    }
  ]
}
```

#### Step 2: Attach Vendor to Requisition (Triggers Email)

**Request:**
```bash
POST http://localhost:5002/api/contract/create
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "requisitionId": <requisition-id-from-step-1>,
  "vendorId": 14
}
```

**Response:**
```json
{
  "message": "Contract created successfully",
  "data": {
    "contract": {
      "id": 123,
      "requisitionId": 10,
      "vendorId": 14,
      "status": "Created",
      "uniqueToken": "abc123...",
      "chatbotDealId": "uuid-here"
    }
  }
}
```

**Email sent to:** `vatsal.s@deuexsolutions.com`

---

### Option 3: Quick Test Script

Create a test file `test-vendor-email.http` (for REST Client extension):

```http
### Get Auth Token (Admin Login)
POST http://localhost:5002/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-admin-password"
}

### Store token from response
@token = <paste-jwt-token-here>

### Create Test Requisition
POST http://localhost:5002/api/requisition
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "subject": "Office Supplies Q1 2026",
  "projectId": 1,
  "products": [
    {
      "productId": 1,
      "quantity": 50,
      "targetPrice": 1200
    }
  ]
}

### Store requisitionId from response
@requisitionId = <paste-requisition-id-here>

### Attach Vendor (This triggers the email!)
POST http://localhost:5002/api/contract/create
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "requisitionId": {{requisitionId}},
  "vendorId": 14
}
```

---

## 📧 Email Types You Can Test

Once the vendor is attached, you can test these email flows:

### 1. **Vendor Attached Email** ✅
- **Trigger**: Attach vendor to requisition
- **API**: `POST /api/contract/create`
- **Email**: "New Requisition Assignment"

### 2. **Status Change Email** ✅
- **Trigger**: Update contract status
- **API**: `PUT /api/contract/update/:contractId`
- **Body**: `{ "status": "Opened" }`
- **Email**: "Contract Status Update"

### 3. **Deal Created Email** ✅
- **Trigger**: Create chatbot deal (automatic on contract creation)
- **Email**: "Negotiation Invitation"

### 4. **Deal Status Notifications** ✅
- **Trigger**: Vendor submits offer → AI decides
- **Email**: "[DEAL ACCEPTED]" / "[ACTION REQUIRED - ESCALATED]"

---

## 🔍 Checking Email Logs

To see email logs in the database:

```sql
SELECT * FROM "EmailLogs"
WHERE "recipientEmail" = 'vatsal.s@deuexsolutions.com'
ORDER BY "createdAt" DESC;
```

Or via API (if available):
```bash
GET http://localhost:5002/api/email-logs?recipientEmail=vatsal.s@deuexsolutions.com
```

---

## 🚀 Backend Logs

Watch backend logs for email sending confirmation:

```bash
npm run dev
```

Look for:
```
[info]: Email sent successfully via AWS SES {
  "to": "vatsal.s@deuexsolutions.com",
  "subject": "New Requisition Assignment: ...",
  "messageId": "<...@deuexsolutions.com>",
  "attempt": 1
}
```

---

## ⚠️ Troubleshooting

### Email not received?

1. **Check spam/junk folder** in `vatsal.s@deuexsolutions.com`

2. **Check backend logs** for errors:
   ```bash
   tail -f logs/combined.log
   ```

3. **Check AWS SES console**:
   - Login to AWS Console
   - Navigate to SES → Sending Statistics
   - Check for bounces or complaints

4. **Verify email is in sandbox mode**:
   - If SES is in sandbox, both sender and recipient must be verified
   - Check if `vatsal.s@deuexsolutions.com` is verified in SES

5. **Check database EmailLog table**:
   ```sql
   SELECT * FROM "EmailLogs"
   WHERE "recipientEmail" = 'vatsal.s@deuexsolutions.com'
   AND status = 'failed';
   ```

---

## 📋 Testing Checklist

- [ ] Vendor created: `vatsal s` (ID: 14)
- [ ] Vendor email: `vatsal.s@deuexsolutions.com`
- [ ] Backend running: `npm run dev`
- [ ] Database connected
- [ ] AWS SES configured
- [ ] Create a requisition (or use existing)
- [ ] Attach vendor (ID: 14) to requisition
- [ ] Email sent successfully (check backend logs)
- [ ] Email received in inbox (check `vatsal.s@deuexsolutions.com`)
- [ ] Email contains correct details
- [ ] Vendor portal link works
- [ ] Chatbot link works

---

## 🎯 Expected Email Content

**Subject:** `New Requisition Assignment: [Requisition Title]`

**Email Body:**
- Greeting: "Hello vatsal s,"
- Requisition details (project, title, due date)
- Products table with quantities and target prices
- Two CTA buttons:
  1. **View in Vendor Portal** → Links to vendor portal
  2. **Start Negotiation** → Links to chatbot

**Sender:** `yug.shah@deuexsolutions.com`

---

## 💡 Additional Commands

### Re-run vendor creation (if needed)
```bash
npm run create:vendor
```
*Note: If vendor already exists, script will show existing details*

### Run email test suite
```bash
npm run test:email
```

### Check vendor in database
```bash
psql -d accordo_mvp -c "SELECT id, name, email, \"userType\", status FROM \"Users\" WHERE email = 'vatsal.s@deuexsolutions.com';"
```

---

## ✅ Success Criteria

You'll know everything is working when:

1. ✅ Backend logs show: "Email sent successfully via AWS SES"
2. ✅ Message ID is returned (e.g., `<abc123...@deuexsolutions.com>`)
3. ✅ Email arrives in `vatsal.s@deuexsolutions.com` inbox
4. ✅ Email is well-formatted with all details
5. ✅ Links in email are clickable and work
6. ✅ Sender shows as `yug.shah@deuexsolutions.com`

---

**Happy Testing! 🚀**

If you encounter any issues, check the backend logs and AWS SES console for more details.
