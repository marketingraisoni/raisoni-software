import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Customer } from '../src/models/Customer.js';
import { Product } from '../src/models/Product.js';
import { Order } from '../src/models/Order.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';
import { Setting } from '../src/models/Setting.js';
import { logger } from '../src/utils/logger.js';
import { USER_TYPE, USER_STATUS } from '../src/constants/user.js';
import { getDefaultPermissions } from '../src/services/permissionService.js';

export async function seedDatabase(options = { reset: false }) {
  try {
    await connectDB();
    logger.info('Starting idempotent database seeding...');

    if (options.reset) {
      logger.warn('Reset flag enabled: cleaning collections...');
      await User.deleteMany({});
      await Customer.deleteMany({});
      await Product.deleteMany({});
      await Order.deleteMany({});
      await InventoryMovement.deleteMany({});
      await Setting.deleteMany({});
    }

    // 1. Seed Users (Configured Admin, Manager, and Team accounts)
    const initialUsers = [
      {
        name: 'Raisoni Jauharis',
        username: 'raisonijauharis',
        email: 'raisonijauharis@gmail.com',
        password: '123456',
        userType: USER_TYPE.SUPER_ADMIN,
        status: USER_STATUS.ACTIVE
      },
      {
        name: 'Marketing Raisoni',
        username: 'marketing.raisoni',
        email: 'marketing.raisoni@gmail.com',
        password: '123456',
        userType: USER_TYPE.MANAGER,
        status: USER_STATUS.ACTIVE
      },
      {
        name: 'Divyesh Raisoni',
        username: 'divyesh.raisoni',
        email: 'divyesh.raisoni@gmail.com',
        password: '123456',
        userType: USER_TYPE.ADMIN,
        status: USER_STATUS.ACTIVE
      },
      {
        name: 'System Administrator',
        username: 'admin',
        email: 'admin@raisoni-demo.local',
        password: '123456',
        userType: USER_TYPE.ADMIN,
        status: USER_STATUS.ACTIVE
      },
      {
        name: 'Staff Operator',
        username: 'staff',
        email: 'staff@raisoni-demo.local',
        password: '123456',
        userType: USER_TYPE.STAFF,
        status: USER_STATUS.ACTIVE
      }
    ];

    const usersMap = {};
    for (const u of initialUsers) {
      const seededUser = {
        ...u,
        permissions: getDefaultPermissions(u.userType),
      };
      let user = await User.findOne({
        $or: [{ email: u.email }, { username: u.username }]
      });
      if (!user) {
        user = await User.create(seededUser);
        logger.info(`Created user: ${u.email} (type ${u.userType})`);
      } else {
        user.name = u.name;
        user.password = u.password; // Triggers pre-save bcrypt hash
        user.userType = u.userType;
        user.status = USER_STATUS.ACTIVE;
        user.permissions = seededUser.permissions;
        await user.save();
        logger.info(`Updated user: ${u.email} (type ${u.userType})`);
      }
      usersMap[u.userType] = user;
    }

    const adminUser = usersMap[USER_TYPE.SUPER_ADMIN] || (await User.findOne({ userType: USER_TYPE.SUPER_ADMIN }));

    // 2. Seed Default Settings
    const defaultSettings = [
      { key: 'appName', value: 'Raisoni Software Demo', category: 'general', description: 'Application display name' },
      { key: 'companyName', value: 'Raisoni Industrial Solutions Ltd.', category: 'general', description: 'Company legal entity' },
      { key: 'currencySymbol', value: '₹', category: 'financial', description: 'Default currency symbol' },
      { key: 'taxRate', value: 18, category: 'financial', description: 'Standard GST / VAT percentage' },
      { key: 'lowStockThreshold', value: 10, category: 'inventory', description: 'Default low stock warning threshold' }
    ];

    for (const s of defaultSettings) {
      await Setting.findOneAndUpdate(
        { key: s.key },
        { ...s, updatedBy: adminUser._id },
        { upsert: true }
      );
    }
    logger.info('Application settings initialized.');

    // 3. Seed Customers (At least 20)
    const demoCustomers = [
      { name: 'Aarav Patel', company: 'Patel Toolcraft Works', email: 'aarav.patel@pateltools.example.com', phone: '+91 98230 11223', address: { street: '12 MIDC Phase II', city: 'Nagpur', state: 'Maharashtra', postalCode: '440028', country: 'India' } },
      { name: 'Kavita Deshmukh', company: 'Deshmukh Infrastructure', email: 'kavita@deshmukhinfa.example.com', phone: '+91 98901 22334', address: { street: '45 Industrial Area', city: 'Pune', state: 'Maharashtra', postalCode: '411014', country: 'India' } },
      { name: 'Vikram Singhania', company: 'Singhania Power Grid', email: 'vikram@singhpower.example.com', phone: '+91 97654 33445', address: { street: '88 Link Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400053', country: 'India' } },
      { name: 'Ananya Iyer', company: 'Apex Electro Devices', email: 'ananya@apexelectro.example.com', phone: '+91 98450 44556', address: { street: '102 Tech Zone', city: 'Bengaluru', state: 'Karnataka', postalCode: '560100', country: 'India' } },
      { name: 'Rohan Kulkarni', company: 'Sahyadri Engineering Works', email: 'rohan@sahyadrieng.example.com', phone: '+91 94220 55667', address: { street: '78 Old Station Road', city: 'Nashik', state: 'Maharashtra', postalCode: '422007', country: 'India' } },
      { name: 'Neha Chawla', company: 'Chawla Fabricators & Co', email: 'neha@chawlafab.example.com', phone: '+91 98111 66778', address: { street: '55 GT Road Sector 18', city: 'Gurugram', state: 'Haryana', postalCode: '122001', country: 'India' } },
      { name: 'Sanjay Reddy', company: 'Deccan Hardware Logistics', email: 'sanjay@deccanhardware.example.com', phone: '+91 99890 77889', address: { street: '14 Auto Nagar', city: 'Hyderabad', state: 'Telangana', postalCode: '500070', country: 'India' } },
      { name: 'Meera Nambiar', company: 'Malabar Marine Components', email: 'meera@malabarmarine.example.com', phone: '+91 94470 88990', address: { street: '22 Harbor Gate', city: 'Kochi', state: 'Kerala', postalCode: '682003', country: 'India' } },
      { name: 'Arjun Sen', company: 'Bengal Metal Castings', email: 'arjun@bengalmetal.example.com', phone: '+91 98300 99001', address: { street: '9 Tara Road', city: 'Kolkata', state: 'West Bengal', postalCode: '700026', country: 'India' } },
      { name: 'Pooja Agarwal', company: 'Jaipur Precision Tools', email: 'pooja@jaipurtools.example.com', phone: '+91 94140 12345', address: { street: '63 Industrial Estate', city: 'Jaipur', state: 'Rajasthan', postalCode: '302013', country: 'India' } },
      { name: 'Gaurav Joshi', company: 'Vidarbha Automation Labs', email: 'gaurav@vidarbhaauto.example.com', phone: '+91 97640 23456', address: { street: '31 Hingna Road', city: 'Nagpur', state: 'Maharashtra', postalCode: '440016', country: 'India' } },
      { name: 'Deepa Menon', company: 'Cochin Electronic Spares', email: 'deepa@cochinspares.example.com', phone: '+91 98460 34567', address: { street: '19 MG Road', city: 'Ernakulam', state: 'Kerala', postalCode: '682011', country: 'India' } },
      { name: 'Rajesh Gupta', company: 'Northland Mining Supplies', email: 'rajesh@northlandmine.example.com', phone: '+91 98765 45678', address: { street: '80 Circular Road', city: 'Ranchi', state: 'Jharkhand', postalCode: '834001', country: 'India' } },
      { name: 'Sunita Rao', company: 'Zenith Telecommunications', email: 'sunita@zenithtelecom.example.com', phone: '+91 99000 56789', address: { street: '11 Electronic City', city: 'Bengaluru', state: 'Karnataka', postalCode: '560068', country: 'India' } },
      { name: 'Karthik Raja', company: 'Kovai Industrial Pumps', email: 'karthik@kovaipumps.example.com', phone: '+91 98422 67890', address: { street: '44 Trichy Road', city: 'Coimbatore', state: 'Tamil Nadu', postalCode: '641018', country: 'India' } },
      { name: 'Tanvi Shah', company: 'Surat Diamond Machinery', email: 'tanvi@suratmachinery.example.com', phone: '+91 98250 78901', address: { street: '90 Ring Road', city: 'Surat', state: 'Gujarat', postalCode: '395002', country: 'India' } },
      { name: 'Manoj Tiwari', company: 'Ganga Heavy Engineering', email: 'manoj@gangaheavy.example.com', phone: '+91 94500 89012', address: { street: '15 Civil Lines', city: 'Varanasi', state: 'Uttar Pradesh', postalCode: '221002', country: 'India' } },
      { name: 'Divya Nair', company: 'Trivandrum Safety Systems', email: 'divya@trivandrumsafety.example.com', phone: '+91 94460 90123', address: { street: '5 Techno Park Way', city: 'Thiruvananthapuram', state: 'Kerala', postalCode: '695581', country: 'India' } },
      { name: 'Aditya Chauhan', company: 'Shimla Agro Machinery', email: 'aditya@shimlaagro.example.com', phone: '+91 98160 01234', address: { street: '24 Cart Road', city: 'Shimla', state: 'Himachal Pradesh', postalCode: '171001', country: 'India' } },
      { name: 'Swati Bansal', company: 'Bansal Electrical Spares', email: 'swati@bansalspares.example.com', phone: '+91 98960 12340', address: { street: '72 Model Town', city: 'Ambala', state: 'Haryana', postalCode: '134003', country: 'India' } },
      { name: 'Harish Mehta', company: 'Mehta Fasteners Corp', email: 'harish@mehtafasteners.example.com', phone: '+91 98200 23451', address: { street: '38 Fort Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' } },
      { name: 'Shreya Bhattacharya', company: 'Howrah Steel Forgings', email: 'shreya@howrahsteel.example.com', phone: '+91 98310 34562', address: { street: '10 Foreshore Road', city: 'Howrah', state: 'West Bengal', postalCode: '711101', country: 'India' } }
    ];

    const customerDocs = [];
    for (const c of demoCustomers) {
      let cust = await Customer.findOne({ email: c.email });
      if (!cust) {
        cust = await Customer.create(c);
      }
      customerDocs.push(cust);
    }
    logger.info(`Seeded ${customerDocs.length} customers successfully.`);

    // 4. Seed Products (At least 30)
    const demoProducts = [
      // Hardware & Tools
      { sku: 'HDW-IMP-001', name: 'Heavy-Duty Impact Drill 850W', category: 'Hardware & Tools', description: 'Industrial dual-speed impact driver with keyless chuck and torque limiter.', costPrice: 3200, sellingPrice: 4850, stockQuantity: 42, minStockThreshold: 10 },
      { sku: 'HDW-ANG-002', name: 'Angle Grinder 125mm 1100W', category: 'Hardware & Tools', description: 'Ergonomic angle grinder with anti-vibration handle and burst-proof guard.', costPrice: 2100, sellingPrice: 3199, stockQuantity: 28, minStockThreshold: 8 },
      { sku: 'HDW-TOR-003', name: 'Digital Precision Torque Wrench 1/2"', category: 'Hardware & Tools', description: 'Calibrated digital torque wrench with audible buzzer and LED alert.', costPrice: 4500, sellingPrice: 6800, stockQuantity: 15, minStockThreshold: 5 },
      { sku: 'HDW-HEX-004', name: 'Hardened Chrome-Vanadium Hex Key Set', category: 'Hardware & Tools', description: '30-piece metric and imperial ball-end hex key set with folding holster.', costPrice: 650, sellingPrice: 1150, stockQuantity: 85, minStockThreshold: 20 },
      { sku: 'HDW-PLY-005', name: 'Heavy Insulated Combination Pliers 8"', category: 'Hardware & Tools', description: '1000V rated VDE certified high-leverage electrical combination pliers.', costPrice: 420, sellingPrice: 750, stockQuantity: 54, minStockThreshold: 15 },
      { sku: 'HDW-SAW-006', name: 'Compact Reciprocating Saw 900W', category: 'Hardware & Tools', description: 'Multi-material sabre saw with tool-less blade clamp and orbital stroke.', costPrice: 3800, sellingPrice: 5600, stockQuantity: 12, minStockThreshold: 6 },

      // Network & LAN Equipment
      { sku: 'NET-SWT-001', name: '24-Port Gigabit Managed PoE+ Switch', category: 'Network Equipment', description: 'L2+ managed rackmount switch with 370W PoE budget and 4 SFP uplink ports.', costPrice: 16500, sellingPrice: 24900, stockQuantity: 18, minStockThreshold: 5 },
      { sku: 'NET-SWT-002', name: '8-Port Gigabit Desktop Unmanaged Switch', category: 'Network Equipment', description: 'Plug-and-play fanless metal casing switch for office LAN workgroups.', costPrice: 1200, sellingPrice: 1850, stockQuantity: 65, minStockThreshold: 15 },
      { sku: 'NET-WAP-003', name: 'Wi-Fi 6 Enterprise Ceiling Access Point', category: 'Network Equipment', description: 'AX3000 dual-band high-density wireless AP with seamless roaming mesh.', costPrice: 5800, sellingPrice: 8900, stockQuantity: 22, minStockThreshold: 6 },
      { sku: 'NET-RTR-004', name: 'Multi-WAN Gigabit Security Router', category: 'Network Equipment', description: 'Dual-WAN load balancing VPN gateway with hardware firewall acceleration.', costPrice: 7200, sellingPrice: 10999, stockQuantity: 14, minStockThreshold: 4 },
      { sku: 'NET-CAT-005', name: 'Cat6 UTP Solid Copper Cable Roll 305m', category: 'Network Equipment', description: 'Pure annealed electrolytic copper 23AWG network cable drum for LAN runs.', costPrice: 6200, sellingPrice: 8800, stockQuantity: 35, minStockThreshold: 10 },
      { sku: 'NET-PNL-006', name: '24-Port Cat6 1U Rackmount Patch Panel', category: 'Network Equipment', description: 'Gold-plated RJ45 contacts with rear cable management bar and label slots.', costPrice: 1400, sellingPrice: 2250, stockQuantity: 40, minStockThreshold: 8 },

      // Power & Electrical
      { sku: 'PWR-UPS-001', name: 'Online Pure Sine Wave UPS 2kVA', category: 'Power & Electrical', description: 'Double conversion online UPS with LCD telemetry and external battery pack port.', costPrice: 19800, sellingPrice: 28500, stockQuantity: 9, minStockThreshold: 4 },
      { sku: 'PWR-UPS-002', name: 'Line-Interactive Office UPS 1000VA', category: 'Power & Electrical', description: 'Microprocessor controlled voltage regulation UPS for desktop PCs and POS.', costPrice: 4100, sellingPrice: 5990, stockQuantity: 26, minStockThreshold: 8 },
      { sku: 'PWR-CAB-003', name: 'Industrial Rubberized 3-Core Extension 25m', category: 'Power & Electrical', description: 'Heavy 16A industrial drum with thermal cut-out switch and splashproof sockets.', costPrice: 1850, sellingPrice: 2800, stockQuantity: 31, minStockThreshold: 10 },
      { sku: 'PWR-MCB-004', name: 'Triple-Pole MCB 32A C-Curve 10kA', category: 'Power & Electrical', description: 'Industrial DIN-rail circuit breaker for commercial distribution panels.', costPrice: 580, sellingPrice: 920, stockQuantity: 90, minStockThreshold: 25 },
      { sku: 'PWR-SPD-005', name: 'Class II 4-Pole Surge Protection Device', category: 'Power & Electrical', description: 'Transient voltage surge suppressor module with optical status window.', costPrice: 2400, sellingPrice: 3750, stockQuantity: 19, minStockThreshold: 5 },

      // Security & Surveillance
      { sku: 'SEC-CAM-001', name: '5MP Smart AI Varifocal Dome Camera', category: 'Security Devices', description: 'PoE IP camera with human & vehicle detection, IR 40m, and weatherproof IP67.', costPrice: 3800, sellingPrice: 5650, stockQuantity: 38, minStockThreshold: 10 },
      { sku: 'SEC-CAM-002', name: '4K Ultra-HD Long Range Bullet Camera', category: 'Security Devices', description: 'Motorized zoom 2.8-12mm optics with smart dual illumination and audio mic.', costPrice: 5400, sellingPrice: 7990, stockQuantity: 20, minStockThreshold: 6 },
      { sku: 'SEC-NVR-003', name: '16-Channel 4K NVR with 16-Port PoE', category: 'Security Devices', description: 'H.265+ network video recorder supporting 2x 10TB HDDs and remote app access.', costPrice: 12500, sellingPrice: 18900, stockQuantity: 8, minStockThreshold: 3 },
      { sku: 'SEC-BIO-004', name: 'Biometric Fingerprint & RFID Access Terminal', category: 'Security Devices', description: 'Time-attendance terminal with TCP/IP LAN, optical sensor, and battery backup.', costPrice: 4900, sellingPrice: 7400, stockQuantity: 16, minStockThreshold: 5 },
      { sku: 'SEC-EML-005', name: 'Electromagnetic Door Lock 600lbs with Bracket', category: 'Security Devices', description: 'Fail-safe magnetic lock with LED status indicator and anti-residual magnetism.', costPrice: 1600, sellingPrice: 2450, stockQuantity: 27, minStockThreshold: 8 },

      // Safety & PPE Equipment
      { sku: 'SFT-HLM-001', name: 'Industrial Ratchet Safety Helmet (Yellow)', category: 'Safety Equipment', description: 'High-density polyethylene safety hard hat with 6-point textile suspension.', costPrice: 220, sellingPrice: 399, stockQuantity: 120, minStockThreshold: 30 },
      { sku: 'SFT-BOT-002', name: 'Steel-Toe Protective Work Boots (Size 9)', category: 'Safety Equipment', description: 'Oil & acid resistant double density PU sole with 200J steel toe cap.', costPrice: 1100, sellingPrice: 1850, stockQuantity: 34, minStockThreshold: 10 },
      { sku: 'SFT-GLV-003', name: 'Cut-Resistant Level 5 Nitrile Work Gloves', category: 'Safety Equipment', description: 'HPPE fiber safety gloves with micro-foam nitrile palm coating for oily grip.', costPrice: 180, sellingPrice: 320, stockQuantity: 150, minStockThreshold: 40 },
      { sku: 'SFT-GOG-004', name: 'Anti-Fog Indirect Vent Safety Goggles', category: 'Safety Equipment', description: 'Polycarbonate panoramic lens protecting against chemical splashes and dust.', costPrice: 140, sellingPrice: 260, stockQuantity: 110, minStockThreshold: 30 },
      { sku: 'SFT-HAR-005', name: 'Full Body Fall Arrest Harness with Lanyard', category: 'Safety Equipment', description: 'Adjustable dorsal D-ring safety harness with energy-absorbing shock lanyard.', costPrice: 1650, sellingPrice: 2600, stockQuantity: 17, minStockThreshold: 5 },

      // Low Stock & Out of Stock Demos (for realistic dashboard warning alerts)
      { sku: 'DEM-LOW-001', name: 'Precision Caliper Micrometer 150mm', category: 'Hardware & Tools', description: 'Hardened stainless steel digital Vernier caliper with thumb roller.', costPrice: 950, sellingPrice: 1550, stockQuantity: 4, minStockThreshold: 10 },
      { sku: 'DEM-LOW-002', name: 'Crimping Tool for RJ45 Pass-Through', category: 'Network Equipment', description: 'Modular ratchet crimper for standard and pass-through network plugs.', costPrice: 750, sellingPrice: 1250, stockQuantity: 3, minStockThreshold: 8 },
      { sku: 'DEM-LOW-003', name: 'Infrared Thermal Imaging Thermometer', category: 'Security Devices', description: 'Handheld thermal imager with LCD screen for electrical hotspots inspection.', costPrice: 11500, sellingPrice: 17200, stockQuantity: 2, minStockThreshold: 5 },
      { sku: 'DEM-OUT-004', name: 'Industrial Fiber Splicing Machine V9', category: 'Network Equipment', description: 'Automatic core alignment fusion splicer with cleaver and carry case.', costPrice: 48000, sellingPrice: 69000, stockQuantity: 0, minStockThreshold: 2 },
      { sku: 'DEM-OUT-005', name: 'Emergency Eye Wash Station Wall Unit', category: 'Safety Equipment', description: 'Double nozzle buffered eye wash unit with stainless steel catch basin.', costPrice: 3400, sellingPrice: 5200, stockQuantity: 0, minStockThreshold: 4 },

      // Additional Office & Enterprise Supplies
      { sku: 'OFC-BAR-001', name: 'Omnidirectional 2D QR Barcode Scanner', category: 'Office Supplies', description: 'USB plug & play desktop presentation scanner with auto-induction sensor.', costPrice: 2400, sellingPrice: 3850, stockQuantity: 22, minStockThreshold: 6 },
      { sku: 'OFC-THM-002', name: 'Thermal Receipt & Label Printer 80mm', category: 'Office Supplies', description: 'Direct thermal POS printer with auto-cutter, USB, Ethernet, and serial ports.', costPrice: 4600, sellingPrice: 6900, stockQuantity: 18, minStockThreshold: 5 },
      { sku: 'OFC-ROL-003', name: 'Direct Thermal Barcode Labels (50x25mm)', category: 'Office Supplies', description: 'Pack of 10 rolls, 1000 labels per roll, smudge-proof adhesive backing.', costPrice: 850, sellingPrice: 1390, stockQuantity: 45, minStockThreshold: 15 }
    ];

    const productDocs = [];
    for (const p of demoProducts) {
      let prod = await Product.findOne({ sku: p.sku });
      if (!prod) {
        prod = await Product.create(p);
        // Create initial stock movement
        if (p.stockQuantity > 0) {
          await InventoryMovement.create({
            product: prod._id,
            sku: prod.sku,
            productName: prod.name,
            type: 'initial',
            previousQuantity: 0,
            changeQuantity: p.stockQuantity,
            newQuantity: p.stockQuantity,
            reason: 'System initialization baseline',
            performedBy: adminUser._id,
            performedByName: adminUser.name
          });
        }
      }
      productDocs.push(prod);
    }
    logger.info(`Seeded ${productDocs.length} products successfully.`);

    // 5. Seed Orders (At least 16 realistic orders across diverse months and statuses)
    const existingOrdersCount = await Order.countDocuments();
    if (existingOrdersCount < 16) {
      logger.info('Creating demo orders...');
      const orderTemplates = [
        { customerIdx: 0, status: 'Completed', daysAgo: 45, discount: 5, tax: 18, payment: 'Bank Transfer', items: [{ prodIdx: 0, qty: 3 }, { prodIdx: 4, qty: 5 }] },
        { customerIdx: 1, status: 'Completed', daysAgo: 38, discount: 0, tax: 18, payment: 'Credit Card', items: [{ prodIdx: 6, qty: 1 }, { prodIdx: 8, qty: 2 }] },
        { customerIdx: 2, status: 'Completed', daysAgo: 30, discount: 10, tax: 18, payment: 'Cheque', items: [{ prodIdx: 12, qty: 1 }, { prodIdx: 14, qty: 4 }] },
        { customerIdx: 3, status: 'Completed', daysAgo: 25, discount: 0, tax: 18, payment: 'UPI', items: [{ prodIdx: 17, qty: 4 }, { prodIdx: 19, qty: 1 }] },
        { customerIdx: 4, status: 'Completed', daysAgo: 21, discount: 8, tax: 18, payment: 'Bank Transfer', items: [{ prodIdx: 1, qty: 4 }, { prodIdx: 3, qty: 10 }] },
        { customerIdx: 5, status: 'Processing', daysAgo: 14, discount: 0, tax: 18, payment: 'Cash', items: [{ prodIdx: 22, qty: 15 }, { prodIdx: 24, qty: 25 }] },
        { customerIdx: 6, status: 'Processing', daysAgo: 10, discount: 5, tax: 18, payment: 'Bank Transfer', items: [{ prodIdx: 7, qty: 3 }, { prodIdx: 10, qty: 2 }] },
        { customerIdx: 7, status: 'Completed', daysAgo: 8, discount: 0, tax: 18, payment: 'UPI', items: [{ prodIdx: 20, qty: 2 }, { prodIdx: 21, qty: 2 }] },
        { customerIdx: 8, status: 'Pending', daysAgo: 5, discount: 0, tax: 18, payment: 'Cash', items: [{ prodIdx: 23, qty: 4 }, { prodIdx: 25, qty: 10 }] },
        { customerIdx: 9, status: 'Pending', daysAgo: 4, discount: 10, tax: 18, payment: 'Cheque', items: [{ prodIdx: 2, qty: 1 }, { prodIdx: 5, qty: 2 }] },
        { customerIdx: 10, status: 'Completed', daysAgo: 3, discount: 0, tax: 18, payment: 'Bank Transfer', items: [{ prodIdx: 13, qty: 2 }, { prodIdx: 15, qty: 8 }] },
        { customerIdx: 11, status: 'Cancelled', daysAgo: 3, discount: 0, tax: 18, payment: 'Cash', reason: 'Customer requested change in project specifications', items: [{ prodIdx: 18, qty: 2 }] },
        { customerIdx: 12, status: 'Processing', daysAgo: 2, discount: 5, tax: 18, payment: 'UPI', items: [{ prodIdx: 32, qty: 2 }, { prodIdx: 33, qty: 1 }] },
        { customerIdx: 13, status: 'Pending', daysAgo: 1, discount: 0, tax: 18, payment: 'Cash', items: [{ prodIdx: 9, qty: 1 }, { prodIdx: 11, qty: 2 }] },
        { customerIdx: 14, status: 'Completed', daysAgo: 1, discount: 0, tax: 18, payment: 'Bank Transfer', items: [{ prodIdx: 26, qty: 2 }, { prodIdx: 16, qty: 2 }] },
        { customerIdx: 15, status: 'Processing', daysAgo: 0, discount: 12, tax: 18, payment: 'Bank Transfer', items: [{ prodIdx: 6, qty: 1 }, { prodIdx: 10, qty: 1 }, { prodIdx: 17, qty: 2 }] }
      ];

      for (let i = 0; i < orderTemplates.length; i++) {
        const tmpl = orderTemplates[i];
        const cust = customerDocs[tmpl.customerIdx % customerDocs.length];
        const orderNumber = `ORD-2026-${String(i + 1).padStart(4, '0')}`;

        const existing = await Order.findOne({ orderNumber });
        if (existing) continue;

        const items = [];
        let subtotal = 0;

        for (const itemTmpl of tmpl.items) {
          const prod = productDocs[itemTmpl.prodIdx % productDocs.length];
          const total = Math.round(prod.sellingPrice * itemTmpl.qty * 100) / 100;
          subtotal += total;

          items.push({
            product: prod._id,
            sku: prod.sku,
            name: prod.name,
            unitCost: prod.costPrice,
            unitPrice: prod.sellingPrice,
            quantity: itemTmpl.qty,
            total
          });
        }

        const discountAmount = Math.round((subtotal * (tmpl.discount / 100)) * 100) / 100;
        const subtotalAfterDiscount = subtotal - discountAmount;
        const taxAmount = Math.round((subtotalAfterDiscount * (tmpl.tax / 100)) * 100) / 100;
        const totalAmount = Math.round((subtotalAfterDiscount + taxAmount) * 100) / 100;

        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - tmpl.daysAgo);

        const order = await Order.create({
          orderNumber,
          customer: cust._id,
          customerSnapshot: {
            name: cust.name,
            email: cust.email,
            phone: cust.phone
          },
          items,
          subtotal,
          discountPercent: tmpl.discount,
          discountAmount,
          taxPercent: tmpl.tax,
          taxAmount,
          totalAmount,
          status: tmpl.status,
          paymentMethod: tmpl.payment,
          notes: tmpl.reason || 'Demo order generated for validation',
          createdBy: adminUser._id,
          cancelledReason: tmpl.status === 'Cancelled' ? tmpl.reason : undefined,
          cancelledAt: tmpl.status === 'Cancelled' ? orderDate : undefined,
          createdAt: orderDate,
          updatedAt: orderDate
        });

        // Record historical movements for completed/processing orders
        if (tmpl.status !== 'Cancelled') {
          for (const item of items) {
            await InventoryMovement.create({
              product: item.product,
              sku: item.sku,
              productName: item.name,
              type: 'sale',
              previousQuantity: 50,
              changeQuantity: -item.quantity,
              newQuantity: 50 - item.quantity,
              referenceOrder: order._id,
              reason: `Order ${order.orderNumber}`,
              performedBy: adminUser._id,
              performedByName: adminUser.name,
              createdAt: orderDate
            });
          }
        }
      }
      logger.info('Demo orders seeded successfully.');
    } else {
      logger.info('Orders already seeded (skipping order creation).');
    }

    logger.success('✅ Database seeding finished successfully!');
    return true;
  } catch (err) {
    logger.error(`Database seeding failed: ${err.message}`);
    throw err;
  } finally {
    // Only disconnect if called directly from CLI
    if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
      await disconnectDB();
    }
  }
}

// Auto-run if executed from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const reset = process.argv.includes('--reset');
  seedDatabase({ reset })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
