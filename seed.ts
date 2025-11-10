// src/seed.ts
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Core
import User from './Model//user';
import Order from './Model/order';
// Loyalty
import Member from './Model/member';
import Tier from './Model/Tier';
import Voucher from './Model/voucher';
import Redemption from './Model/redemption';
// Affiliate
import Affiliate from './Model/affiliate';
import AffiliateTier from './Model/affiliateTier';
import AffiliateOrder from './Model/affiliateOrder';
import Payout from './Model/payout';
// Logs
import PointTransaction from './Model/pointTransaction';
import MemberTierLog from './Model/memberTierLog';
import MessageLog from './Model/messageLog';
import AffiliateClick from './Model/affiliateClick';

const MONGO_URI = process.env.MONGO_URL || 'mongodb+srv://dinhsang123:sang280604@cluster0.aj6qm.mongodb.net/loyalty';

const cleanDatabase = async () => {
  console.log('--- CLEANING DATABASE ---');
  // Xóa theo thứ tự ngược lại để tránh lỗi tham chiếu (nếu có)
  const models: mongoose.Model<any>[] = [
    AffiliateOrder, Payout, AffiliateClick,
    PointTransaction, MemberTierLog, MessageLog, Redemption,
    Order, Affiliate, Member, User,
    AffiliateTier, Tier, Voucher
  ];
  
  for (const model of models) {
    await model.deleteMany({});
  }
  console.log('Database cleaned.');
};

const seedDatabase = async () => {
  console.log('--- STARTING SEED ---');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // --- LEVEL 0: Dữ liệu độc lập (Tiers & Vouchers) ---
    console.log('Seeding Level 0...');

    const [tierBronze, tierSilver, tierGold] = await Tier.create([
      { name: 'Bronze', min_points: 0, benefits: { discount: 0, pointMultiplier: 1 } },
      { name: 'Silver', min_points: 500, benefits: { discount: 0.03, pointMultiplier: 1.2 } },
      { name: 'Gold', min_points: 1500, benefits: { discount: 0.05, pointMultiplier: 1.5 } },
    ], { session , ordered: true });

    const [affTierBronze, affTierSilver, affTierGold] = await AffiliateTier.create([
      { name: 'Bronze Partner', commission_rate: 0.03, min_sales: 0 },
      { name: 'Silver Partner', commission_rate: 0.05, min_sales: 5_000_000 },
      { name: 'Gold Partner', commission_rate: 0.08, min_sales: 20_000_000 },
    ], { session , ordered: true });

    const [voucher50k, voucherFreeship] = await Voucher.create([
      { 
        title: 'Voucher giảm 50.000đ', 
        pointsRequired: 200, 
        totalQuantity: 100, 
        remainingQuantity: 100,
        validTo: new Date('2026-12-31')
      },
      { 
        title: 'Voucher Miễn phí vận chuyển', 
        pointsRequired: 100, 
        totalQuantity: 200, 
        remainingQuantity: 200,
        validTo: new Date('2026-12-31')
      },
    ], { session , ordered: true });

    // --- LEVEL 1: Users (Tài khoản đăng nhập) ---
    console.log('Seeding Level 1...');
    const hashedPass = await bcrypt.hash('123456', 12);

    const [userMai, userBach, userHieu] = await User.create([
      // Mai (Khách hàng)
      { phone: '0905111222', email: 'mai@gmail.com', password: hashedPass,role:"member" },
      // Bách (Affiliate)
      { phone: '0905333444', email: 'bach@gmail.com', password: hashedPass ,role:"member" },
      // Hiếu (Super user)
      { phone: '0905555666', email: 'hieu@gmail.com', password: hashedPass ,role:"admin" },
    ], { session , ordered: true });

    // --- LEVEL 2: Profiles (Member & Affiliate) ---
    console.log('Seeding Level 2...');

    // Mai (Khách hàng)
    const [memberMai] = await Member.create([
      {
        user: userMai._id,
        phone: '0905111222',
        name: 'Trần Thị Mai',
        tier: tierSilver._id,
        totalPoints: 645,
        redeemablePoints: 445, // (100 signup + 300 order1 + 245 order2 - 200 redeem)
        lastActiveAt: new Date()
      }
    ], { session , ordered: true });
    userMai.memberProfile = memberMai._id;

    // Bách (Affiliate)
    const [affiliateBach] = await Affiliate.create([
      {
        user: userBach._id,
        phone: '0905333444',
        email: 'bach@gmail.com',
        name: 'Nguyễn Văn Bách',
        referral_code: 'AFF-BACH',
        tier: affTierSilver._id,
        total_sales: 7_000_000,
        total_commission: 100_000 // (Đã kiếm 350k, rút 250k)
      }
    ], { session , ordered: true });
    userBach.affiliateProfile = affiliateBach._id;

    // Hiếu (Super user)
    const [memberHieu] = await Member.create([
      {
        user: userHieu._id,
        phone: '0905555666',
        name: 'Lê Văn Hiếu',
        tier: tierGold._id,
        totalPoints: 1600,
        redeemablePoints: 1600, // (100 signup + 1500 order)
        lastActiveAt: new Date()
      }
    ], { session , ordered: true });
    const [affiliateHieu] = await Affiliate.create([
      {
        user: userHieu._id,
        phone: '0905555666',
        email: 'hieu@gmail.com',
        name: 'Lê Văn Hiếu',
        referral_code: 'AFF-HIEU',
        tier: affTierGold._id,
        total_sales: 25_000_000,
        total_commission: 1_200_000 // (Hoa hồng chưa duyệt không tính)
      }
    ], { session , ordered: true});
    userHieu.memberProfile = memberHieu._id;
    userHieu.affiliateProfile = affiliateHieu._id;
    
    // Lưu các liên kết ngược
    await userMai.save({ session  });
    await userBach.save({ session  });
    await userHieu.save({ session });
    
    // --- LEVEL 3: Redemptions & Orders (Giao dịch chính) ---
    console.log('Seeding Level 3...');

    // Mai đổi voucher 50k
    const [redemptionMai] = await Redemption.create([
      {
        memberId: memberMai._id,
        voucherId: voucher50k._id,
        voucherCode: 'Z-MAI50K',
        pointsSpent: 200,
        status: 'used', // Đã dùng
        usedAt: new Date()
      }
    ], { session , ordered: true });
    
    // Tạo 3 đơn hàng
    const [order1, order2, order3] = await Order.create([
      // Order 1: Mai mua, do Bách giới thiệu
      {
        customer: memberMai._id,
        items: [{ name: 'Sản phẩm A', quantity: 2, price: 1_500_000 }],
        total_amount: 3_000_000,
        status: 'paid',
        affiliate_referral: affiliateBach._id,
      },
      // Order 2: Mai mua, do Hiếu giới thiệu, dùng voucher 50k
      {
        customer: memberMai._id,
        items: [{ name: 'Sản phẩm B', quantity: 1, price: 2_000_000 }],
        total_amount: 1_950_000, // (2tr - 50k voucher)
        status: 'paid',
        affiliate_referral: affiliateHieu._id,
        redemption_used: redemptionMai._id,
      },
      // Order 3: Hiếu tự mua
      {
        customer: memberHieu._id,
        items: [{ name: 'Sản phẩm C', quantity: 10, price: 1_000_000 }],
        total_amount: 10_000_000,
        status: 'paid',
      }
    ], { session , ordered: true });

    // --- LEVEL 4: Logs & Payouts (Dữ liệu lịch sử) ---
    console.log('Seeding Level 4...');

    // Payout (Bách rút tiền)
    await Payout.create([
      {
        affiliate: affiliateBach._id,
        amount: 250_000,
        status: 'requested', // Đang chờ duyệt
      }
    ], { session , ordered: true });

    // Affiliate Orders (Ghi nhận hoa hồng)
    await AffiliateOrder.create([
      // Hoa hồng cho Bách (đã duyệt, đã cộng tiền)
      {
        affiliate: affiliateBach._id,
        order: order1._id,
        order_value: 3_000_000,
        commission_amount: 150_000, // 5% của 3tr
        status: 'paid', // 'paid' = đã duyệt
      },
      // Hoa hồng cho Hiếu (chưa duyệt)
      {
        affiliate: affiliateHieu._id,
        order: order2._id,
        order_value: 1_950_000,
        commission_amount: 156_000, // 8% của 1.95tr
        status: 'pending', // 'pending' = chờ duyệt
      }
    ], { session , ordered: true });

    // Point Transactions (Lịch sử điểm)
    await PointTransaction.create([
      // Mai
      { memberId: memberMai._id, type: 'earn', amount: 100, source: 'signup', description: 'Chào mừng thành viên mới' },
      { memberId: memberMai._id, type: 'earn', amount: 300, source: 'order_completed', refId: order1._id.toString() },
      { memberId: memberMai._id, type: 'earn', amount: 245, source: 'order_completed', refId: order2._id.toString() },
      { memberId: memberMai._id, type: 'spend', amount: -200, source: 'redeem_voucher', refId: redemptionMai._id.toString() },
      // Hiếu
      { memberId: memberHieu._id, type: 'earn', amount: 100, source: 'signup', description: 'Chào mừng thành viên mới' },
      { memberId: memberHieu._id, type: 'earn', amount: 1500, source: 'order_completed', refId: order3._id.toString() },
    ], { session , ordered: true });

    // Member Tier Logs (Lịch sử lên hạng)
    await MemberTierLog.create([
      { memberId: memberMai._id, oldTier: tierBronze._id, newTier: tierSilver._id, reason: 'Đạt 645 điểm' },
      { memberId: memberHieu._id, oldTier: tierBronze._id, newTier: tierSilver._id, reason: 'Đạt 500 điểm' },
      { memberId: memberHieu._id, oldTier: tierSilver._id, newTier: tierGold._id, reason: 'Đạt 1600 điểm' },
    ], { session , ordered: true });

    // Message Logs (Lịch sử Zalo)
    await MessageLog.create([
      { memberId: memberMai._id, channel: 'ZALO_OA', status: 'sent', payload: { msg: 'Chào mừng Mai' } },
      { memberId: memberHieu._id, channel: 'ZALO_OA', status: 'sent', payload: { msg: 'Chào mừng Hiếu' } },
    ], { session , ordered: true });

    // Affiliate Clicks
    await AffiliateClick.create([
      { affiliate: affiliateBach._id, ip: '1.2.3.4', userAgent: 'Chrome' },
      { affiliate: affiliateBach._id, ip: '1.2.3.5', userAgent: 'Firefox' },
      { affiliate: affiliateHieu._id, ip: '1.2.3.6', userAgent: 'Chrome' },
    ], { session  , ordered: true});


    await session.commitTransaction();
    console.log('✅ SEEDING SUCCESSFUL');
  } catch (error) {
    await session.abortTransaction();
    console.error('--- SEEDING FAILED ---');
    console.error(error);
  } finally {
    session.endSession();
  }
};

// --- HÀM CHẠY CHÍNH ---
const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    await cleanDatabase();
    await seedDatabase();

  } catch (error) {
    console.error('Failed to connect or seed database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

run();