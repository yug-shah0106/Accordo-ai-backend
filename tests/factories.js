/**
 * Test data factories for creating mock data
 */
export const createMockUser = (overrides = {}) => ({
    name: 'Test User',
    email: 'test@example.com',
    phone: '1234567890',
    password: 'password123',
    userType: 'admin',
    companyId: 1,
    roleId: 1,
    status: 'active',
    approvalLevel: 'NONE',
    approvalLimit: 0,
    ...overrides,
});
export const createMockCompany = (overrides = {}) => ({
    name: 'Test Company',
    email: 'company@example.com',
    phone: '9876543210',
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    pincode: '123456',
    ...overrides,
});
export const createMockRequisition = (overrides = {}) => ({
    projectId: 1,
    rfqId: 'RFQ001',
    subject: 'Test Requisition',
    category: 'Electronics',
    deliveryDate: new Date('2026-03-15'),
    maxDeliveryDate: new Date('2026-03-20'),
    negotiationClosureDate: new Date('2026-02-28'),
    typeOfCurrency: 'USD',
    totalPrice: 1000,
    status: 'Created',
    approvalStatus: 'NOT_SUBMITTED',
    ...overrides,
});
export const createMockRequisitionProduct = (overrides = {}) => ({
    requisitionId: 1,
    productId: 1,
    targetPrice: 50,
    maximum_price: 60,
    qty: 100,
    ...overrides,
});
export const createMockVendor = (overrides = {}) => ({
    name: 'Test Vendor',
    email: 'vendor@example.com',
    phone: '1111111111',
    userType: 'vendor',
    companyId: 1,
    status: 'active',
    ...overrides,
});
export const createMockProject = (overrides = {}) => ({
    projectName: 'Test Project',
    companyId: 1,
    status: 'active',
    ...overrides,
});
export const createMockProduct = (overrides = {}) => ({
    productName: 'Test Product',
    category: 'Electronics',
    brandName: 'Test Brand',
    gstType: 'GST',
    gstPercentage: 18,
    tds: 12345,
    type: 'Goods',
    UOM: 'pieces',
    companyId: 1,
    ...overrides,
});
export const createMockProductNonGst = (overrides = {}) => ({
    productName: 'Non-GST Product',
    category: 'Services',
    brandName: 'Service Brand',
    gstType: 'Non-GST',
    gstPercentage: null,
    tds: 67890,
    type: 'Services',
    UOM: 'pieces',
    companyId: 1,
    ...overrides,
});
export const createMockChatbotDeal = (overrides = {}) => ({
    title: 'Test Deal',
    mode: 'INSIGHTS',
    status: 'NEGOTIATING',
    round: 0,
    requisitionId: 1,
    vendorId: 1,
    userId: 1,
    negotiationConfigJson: {},
    weightsJson: {},
    ...overrides,
});
export const createMockRole = (overrides = {}) => ({
    name: 'Admin',
    companyId: 1,
    isArchived: false,
    ...overrides,
});
//# sourceMappingURL=factories.js.map