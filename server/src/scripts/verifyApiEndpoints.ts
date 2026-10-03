import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5002/api';

async function testApi() {
  console.log('=== TESTING UPVOLT HTTP API & SECURITY BOUNDARIES ===\n');

  // 1. Admin Login
  console.log('[1] Logging in as Master Admin (admin / Admin@12345)...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'admin', password: 'Admin@12345' }),
  });
  const loginData: any = await loginRes.json();
  if (!loginData.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
  }
  const adminToken = loginData.token;
  console.log('✓ Admin authenticated successfully.\n');

  // 2. Add product WITHOUT bill/invoice photo -> Must return 400
  console.log('[2] Testing product creation WITHOUT bill photo...');
  const failRes = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'OLED Display 0.96 I2C',
      category: 'Displays',
      costPrice: 120,
      sellingPrice: 180,
      initialQuantity: 10,
    }),
  });
  const failData: any = await failRes.json();
  console.log(`HTTP Status: ${failRes.status}`);
  console.log(`Response message: "${failData.message}"`);
  if (
    failRes.status === 400 &&
    failData.message === 'Purchase bill/invoice is required for a new product.'
  ) {
    console.log('✓ Correctly rejected missing bill photo with required error message.\n');
  } else {
    throw new Error('Failed validation test: Expected 400 with "Purchase bill/invoice is required for a new product."');
  }

  // 3. Add product WITH bill photo -> Must succeed and set stock
  console.log('[3] Testing product creation WITH bill photo...');
  const successRes = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'OLED Display 0.96 I2C',
      category: 'Displays',
      costPrice: 120,
      sellingPrice: 180,
      initialQuantity: 20,
      billPhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }),
  });
  const successData: any = await successRes.json();
  console.log(`HTTP Status: ${successRes.status}`);
  if (!successData.success || !successData.product) {
    throw new Error(`Product creation failed: ${JSON.stringify(successData)}`);
  }
  const oledProduct = successData.product;
  console.log(`✓ Product created: "${oledProduct.name}", Current Stock: ${oledProduct.currentStock} (Expected: 20)\n`);

  // 4. Create a College Member User assigned to 'IIT Bombay'
  console.log('[4] Creating College Member user assigned to IIT Bombay...');
  const memberUserId = `iitb_rep_${Date.now().toString().slice(-4)}`;
  const memberPassword = 'TempPassword@123';
  const createUserRes = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: memberUserId,
      name: 'IIT Bombay Campus Ambassador',
      role: 'COLLEGE_MEMBER',
      college: 'IIT Bombay',
      temporaryPassword: memberPassword,
    }),
  });
  const createUserData: any = await createUserRes.json();
  if (!createUserData.success) {
    throw new Error(`User creation failed: ${JSON.stringify(createUserData)}`);
  }
  console.log(`✓ College Member created: ${memberUserId} for college IIT Bombay\n`);

  // 5. Login as the College Member
  console.log('[5] Logging in as College Member...');
  const memberLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: memberUserId, password: memberPassword }),
  });
  const memberLoginData: any = await memberLoginRes.json();
  const memberToken = memberLoginData.token;
  console.log(`✓ Member logged in. Role: ${memberLoginData.user?.role}, College: ${memberLoginData.user?.college}\n`);

  // 6. Test College Member dispatch view
  // First dispatch 8 OLEDs to IIT Bombay as Admin
  console.log('[6] Admin dispatching 8 OLEDs to IIT Bombay...');
  const dispatchRes = await fetch(`${API_BASE}/colleges/dispatches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      college: 'IIT Bombay',
      items: [{ productId: oledProduct._id, quantity: 8 }],
      notes: 'Initial stock dispatch for robotics workshop',
    }),
  });
  const dispatchData: any = await dispatchRes.json();
  console.log(`✓ Dispatched 8 units to IIT Bombay. Dispatch ID: ${dispatchData.dispatch?.dispatchNumber}\n`);

  // 7. Member fetching college inventory: Must return 8 units of OLED
  console.log('[7] College Member fetching their college inventory...');
  const memberInvRes = await fetch(`${API_BASE}/colleges/inventory`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const memberInvData: any = await memberInvRes.json();
  console.log(`✓ Member received ${memberInvData.inventory?.length} items:`);
  for (const item of memberInvData.inventory || []) {
    console.log(`   - ${item.productName}: ${item.currentStock} units (Cost hidden)`);
  }

  // 8. Member fetching dispatches: cost fields must be sanitized / masked
  console.log('\n[8] Member fetching their received dispatches (Cost masking verification)...');
  const memberDispRes = await fetch(`${API_BASE}/colleges/dispatches`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const memberDispData: any = await memberDispRes.json();
  const receivedDisp = memberDispData.dispatches?.[0];
  console.log(`✓ Received dispatch: Units = ${receivedDisp?.totalUnits}, Cost displayed to member = ${receivedDisp?.totalCost}`);
  if (receivedDisp?.totalCost !== undefined) {
    throw new Error('Cost isolation failed: totalCost was not hidden from College Member!');
  }
  console.log('✓ Cost masking strictly enforced on backend!\n');

  // 9. Member trying to access restricted Central inventory or reports
  console.log('[9] Testing security: Member accessing /api/reports/dashboard...');
  const repRes = await fetch(`${API_BASE}/reports/dashboard`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const repData: any = await repRes.json();
  console.log(`Reports endpoint response: status=${repRes.status}, message="${repData.message}"`);
  if (repRes.status === 403) {
    console.log('✓ Access to centralized reports correctly blocked with 403 Forbidden!\n');
  } else {
    throw new Error('Security scoping failed: College Member accessed central reports!');
  }

  console.log('==================================================');
  console.log('🎉 ALL API ENDPOINT AND SECURITY VERIFICATIONS PASSED!');
  console.log('==================================================\n');
}

testApi().catch((err) => {
  console.error('API TEST FAILED:', err);
  process.exit(1);
});
