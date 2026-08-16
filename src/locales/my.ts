import en from "./en";

// NOTE: this file must define every key explicitly — it must NOT spread
// `...en` as a fallback. A missing key here is a compile-time error,
// never a silent English fallback (roadmap task 1.3).
//
// Keys that still carry Thai placeholder text (pending a Myanmar-speaking
// owner's review) are marked inline with `// TODO(my)` — translate them
// to Burmese; the placeholder keeps the surface non-English meanwhile.
const my: Record<keyof typeof en, string> = {
  "app.title": "KMM အမှုဆောင် ဒက်ရှ်ဘုတ်",
  "app.subtitle": "KMM အရောင်းဆိုင်ရာ ခွဲခြမ်းစိတ်ဖြာမှု",
  "nav.dashboard": "Dashboard",
  "nav.dailyReport": "နေ့စဉ် Report",
  "nav.sales": "Sales",
  "nav.booking": "Booking",
  "nav.stock": "Stock",
  "nav.marketing": "Marketing",
  "nav.weather": "Weather",
  "nav.weatherAgriculture": "Weather & Agriculture",
  "nav.expense": "အသုံးစရိတ်",
  "nav.team": "အဖွဲ့",
  "nav.dataHub": "Data Hub",
  "nav.settings": "Settings",
  "nav.logout": "ထွက်ရန်",
  "nav.expand": "ဘေးမီနူး ဖြန့်ရန်",
  "nav.collapse": "ဘေးမီနူး ခေါက်ရန်",
  "nav.close": "မီနူး ပိတ်ရန်",
  "nav.primary": "အဓိက မီနူး",
  "company.current": "လက်ရှိ ကုမ္ပဏီ",
  "route.companyManagement.title": "ကုမ္ပဏီ စီမံခန့်ခွဲမှု",
  "route.companyManagement.subtitle": "Enterprise configuration",
  "route.dashboard.title": "Dashboard",
  "route.dashboard.subtitle": "KMM Executive Intelligence",
  "route.dailyManagement.title": "နေ့စဉ် စီမံခန့်ခွဲမှု",
  "route.dailyManagement.subtitle": "Sales · Booking · Stock overview",
  "route.sales.title": "Sales Performance",
  "route.sales.subtitle": "KMM Sales Intelligence",
  "route.booking.title": "Booking Intelligence",
  "route.booking.subtitle": "KMM Booking Intelligence",
  "route.stock.title": "Stock Intelligence",
  "route.stock.subtitle": "KMM Inventory Intelligence",
  "route.marketing.title": "Marketing Intelligence",
  "route.marketing.subtitle": "KMM Geospatial Intelligence",
  "route.weather.title": "Weather & Agriculture",
  "route.weather.subtitle": "Weather, crop calendar, and sales opportunity in one place",
  "route.dataHub.title": "Data Hub",
  "route.dataHub.subtitle": "Enterprise Data Hub",
  "route.settings.title": "Settings",
  "route.settings.subtitle": "Enterprise Control Center",
  "route.expense.title": "အသုံးစရိတ် ခွဲခြမ်းစိတ်ဖြာမှု",
  "route.expense.subtitle": "KMM Financial Intelligence",
  "route.team.title": "Sales Organization",
  "route.team.subtitle": "KMM Organization Intelligence",
  "page.dataHubSubtitle": "ศูนย์ข้อมูลระดับองค์กร", // TODO(my)
  "common.all": "အားလုံး",
  "common.copy": "ကူးယူရန်",
  "common.currentSnapshot": "လက်ရှိ အခြေအနေ",
  "common.cumulative": "စုစုပေါင်း",
  "common.dataNotConnected": "Data မချိတ်ဆက်ရသေးပါ",
  "common.exportDebugJson": "Debug JSON ထုတ်ရန်",
  "common.loading": "Loading...",
  "common.more": "နောက်ထပ်",
  "common.noData": "Data မရှိပါ",
  "common.notAvailable": "N/A",
  "common.selectedPeriod": "ရွေးချယ်ထားသော ကာလ",
  "common.units": "စီးရေ",
  "common.days": "วัน", // TODO(my)
  "common.records": "รายการ", // TODO(my)
  "common.periods": "ช่วงข้อมูลที่พบ", // TODO(my)
  "common.model": "รุ่นสินค้า", // TODO(my)
  "common.payment": "ประเภทการชำระเงิน", // TODO(my)
  "common.stock": "สต็อก", // TODO(my)
  "common.booking": "ยอดจอง", // TODO(my)
  "common.category": "รายการ", // TODO(my)
  "common.value": "จำนวน", // TODO(my)
  "common.contribution": "สัดส่วนผลงาน", // TODO(my)
  "common.averageAge": "อายุเฉลี่ย", // TODO(my)
  "common.conversion": "อัตราส่งมอบ", // TODO(my)
  "common.lowerConcentration": "กระจุกตัวน้อย", // TODO(my)
  "common.higherConcentration": "กระจุกตัวมาก", // TODO(my)
  "common.date": "วันที่", // TODO(my)
  "common.activity": "รายการ", // TODO(my)
  "common.owner": "ผู้รับผิดชอบ", // TODO(my)
  "common.status": "สถานะ", // TODO(my)
  "common.openNavigation": "မီနူး ဖွင့်ရန်",
  "common.openNotifications": "အသိပေးချက်များ ဖွင့်ရန်",
  "common.openProfileMenu": "Profile မီနူး ဖွင့်ရန်",
  "common.clearTownshipSelection": "Township ရွေးချယ်မှု ရှင်းရန်",
  "common.refresh": "Refresh",
  "common.reset": "Reset",
  "common.export": "Export",
  "common.saveDraft": "Draft သိမ်းရန်",
  "common.publish": "Publish",
  "common.cancel": "ပယ်ဖျက်ရန်",
  "common.close": "ပိတ်ရန်",
  "common.search": "ရှာဖွေရန်",
  "common.searchNavigation": "စာမျက်နှာနှင့် tool များ ရှာရန်…",
  "common.clearSearch": "ရှာဖွေမှု ရှင်းရန်",
  "common.navigationResults": "Navigation results",
  "common.quickNavigation": "Quick navigation",
  "common.noNavigationResults": "ကိုက်ညီသော စာမျက်နှာ မတွေ့ပါ",
  "common.filters": "Filters",
  "common.rows": "rows",
  "common.exporting": "Export လုပ်နေသည်",
  "common.retry": "ထပ်ကြိုးစားရန်",
  "common.empty": "ရွေးထားသော Filter အတွက် Data မရှိပါ",
  "common.noOptions": "ရွေးချယ်စရာ မတွေ့ပါ",
  "common.selectedCount": "ရွေးထားသည်",
  "common.activeFilters": "အသုံးပြုထားသော Filters",
  "common.clearAll": "အားလုံး ရှင်းရန်",
  "common.viewRefreshed": "Data အပ်ဒိတ်ချိန်",
  "common.freshnessUnavailable": "ไม่พบเวลาปรับปรุงข้อมูล", // TODO(my)
  "filter.year": "ปี", // TODO(my)
  "filter.month": "เดือน", // TODO(my)
  "filter.branch": "สาขา", // TODO(my)
  "filter.salesperson": "พนักงานขาย", // TODO(my)
  "filter.productGroup": "กลุ่มสินค้า", // TODO(my)
  "filter.productType": "ประเภทสินค้า", // TODO(my)
  "filter.bookingStatus": "สถานะการจอง", // TODO(my)
  "filter.allProducts": "สินค้าทั้งหมด", // TODO(my)
  "metric.grossProfit": "กำไรขั้นต้น", // TODO(my)
  "metric.stockUnit": "จำนวนสินค้าคงคลัง", // TODO(my)
  "metric.stockValue": "มูลค่าสินค้าคงคลัง", // TODO(my)
  "metric.depositReceived": "เงินมัดจำที่ได้รับ", // TODO(my)
  "metric.averageBookingAge": "อายุการจองเฉลี่ย", // TODO(my)
  "metric.bookingConversionRate": "อัตราส่งมอบจากยอดจอง", // TODO(my)
  "metric.stockCoverage": "ความเพียงพอของสต็อก", // TODO(my)
  "metric.agedStock": "สต็อกค้างเกิน 90 วัน", // TODO(my)
  "metric.averageStockAge": "อายุสต็อกเฉลี่ย", // TODO(my)
  "metric.stockGap": "ส่วนต่างสต็อก", // TODO(my)
  "metric.averageSellingPrice": "ราคาขายเฉลี่ย (ASP)", // TODO(my)
  "dashboard.selectOneYearForYoy": "เลือก 1 ปีเพื่อเทียบกับปีก่อน", // TODO(my)
  "dashboard.compareWith": "เทียบกับ", // TODO(my)
  "dashboard.bookingValue": "มูลค่ายอดจอง", // TODO(my)
  "dashboard.deposit": "เงินมัดจำ", // TODO(my)
  "settings.searchPlaceholder": "ค้นหาการตั้งค่า…", // TODO(my)
  "settings.searchLabel": "ค้นหาการตั้งค่า", // TODO(my)
  "settings.clearSearch": "ล้างคำค้นหา", // TODO(my)
  "settings.noResults": "ไม่พบการตั้งค่าที่ค้นหา", // TODO(my)
  "settings.noResultsHint": "ลองใช้คำค้นหาอื่น", // TODO(my)
  "settings.open": "เปิด", // TODO(my)
  "settings.active": "พร้อมใช้งาน", // TODO(my)
  "settings.companyTitle": "จัดการบริษัท", // TODO(my)
  "settings.companyDescription": "ข้อมูลบริษัท · สาขา · แผนก · ปีบัญชี", // TODO(my)
  "settings.usersTitle": "จัดการผู้ใช้งาน", // TODO(my)
  "settings.usersDescription": "ผู้ใช้งาน · โปรไฟล์ · สิทธิ์เข้าถึง", // TODO(my)
  "settings.rolesTitle": "บทบาทและสิทธิ์", // TODO(my)
  "settings.rolesDescription": "บทบาท · สิทธิ์ · การอนุมัติ", // TODO(my)
  "settings.aiTitle": "ตั้งค่า AI", // TODO(my)
  "settings.aiDescription": "โมเดล AI · หน่วยความจำ · คำสั่ง · ตัวแทนอัตโนมัติ", // TODO(my)
  "settings.dashboardTitle": "ตั้งค่าแดชบอร์ด", // TODO(my)
  "settings.dashboardDescription": "วิดเจ็ต · การจัดวาง · KPI", // TODO(my)
  "settings.themeTitle": "ธีมและภาษา", // TODO(my)
  "settings.themeDescription": "ธีม · โหมดมืด · โหมดสว่าง · ภาษา", // TODO(my)
  "settings.backupTitle": "สำรองข้อมูล", // TODO(my)
  "settings.backupDescription": "สำรองอัตโนมัติ · กู้คืน · ตารางเวลา", // TODO(my)
  "settings.auditTitle": "ประวัติการใช้งาน", // TODO(my)
  "settings.auditDescription": "ประวัติ · กิจกรรม · ความปลอดภัย", // TODO(my)
  "section.salesTrajectory": "แนวโน้มยอดขาย", // TODO(my)
  "section.salesTrajectoryDescription": "ติดตามแนวโน้มยอดขายและสถานะเทียบเป้าหมายตามตัวกรองที่เลือก", // TODO(my)
  "section.bookingPipeline": "ภาพรวมการจอง", // TODO(my)
  "section.bookingPipelineDescription": "ติดตามสถานะ อายุการจอง และภาระงานของแต่ละสาขา", // TODO(my)
  "section.stockRisk": "ความเสี่ยงและความเพียงพอของสต็อก", // TODO(my)
  "section.stockRiskDescription": "ติดตามอายุสินค้าคงคลังและความเพียงพอเมื่อเทียบกับยอดจอง", // TODO(my)
  "chart.salesTrendTitle": "แนวโน้มยอดขาย", // TODO(my)
  "chart.salesTrendDescription": "เปรียบเทียบผลการขายตามปี ช่วงเวลา และตัวชี้วัด", // TODO(my)
  "chart.bookingHealthTitle": "ภาพรวมอายุยอดจอง", // TODO(my)
  "chart.bookingHealthDescription": "จำนวนและมูลค่ายอดจองคงค้าง แยกตามอายุการจอง", // TODO(my)
  "chart.stockHealthTitle": "ภาพรวมอายุสต็อก", // TODO(my)
  "chart.stockHealthDescription": "อายุสินค้าคงเหลือ นับจากวันที่รับเข้า", // TODO(my)
  "section.rankingsMix": "อันดับและสัดส่วนยอดขาย", // TODO(my)
  "section.rankingsMixDescription": "วิเคราะห์ผลงานตามสาขา พนักงานขาย กลุ่มสินค้า และรุ่นสินค้า", // TODO(my)
  "section.secondaryAnalysis": "วิเคราะห์เชิงลึก", // TODO(my)
  "section.dashboardSecondaryDescription": "ติดตามสถานะการจอง ความเพียงพอของสต็อก และสัดส่วนสินค้าเพื่อใช้ตัดสินใจ", // TODO(my)
  "section.stockCoverage": "ความเพียงพอของสต็อก", // TODO(my)
  "section.stockCoverageDescription": "เปรียบเทียบสินค้าคงคลังกับยอดจองคงค้างในแต่ละรุ่น", // TODO(my)
  "section.branchPerformance": "สถานะสินค้ารายสาขา", // TODO(my)
  "section.branchPerformanceDescription": "เปรียบเทียบจำนวนสินค้า ยอดจองคงค้าง มูลค่า และอายุสต็อกของแต่ละสาขา", // TODO(my)
  "section.stockSecondaryDescription": "วิเคราะห์สัดส่วนสินค้า อายุสต็อกรายรุ่น และรายการที่ควรติดตาม", // TODO(my)
  "section.bookingSecondaryDescription": "วิเคราะห์ยอดจองตามสินค้า รุ่น พนักงานขาย การชำระเงิน และอายุการจอง", // TODO(my)
  "section.transactions": "รายการขาย", // TODO(my)
  "section.transactionsDescription": "รายละเอียดจากข้อมูลต้นทางตามตัวกรองที่เลือก", // TODO(my)
  "chart.branchPerformanceTitle": "ผลงานรายสาขา", // TODO(my)
  "chart.branchPerformanceDescription": "เรียงอันดับสาขาตามจำนวนขาย", // TODO(my)
  "chart.bookingLifecycleTitle": "สถานะยอดจองรายเดือน", // TODO(my)
  "chart.bookingLifecycleDescription": "แยกจำนวนรายการรายเดือนตามสถานะจากข้อมูลต้นทาง", // TODO(my)
  "chart.stockVsBookingTitle": "สต็อกเทียบยอดจอง", // TODO(my)
  "chart.stockVsBookingDescription": "เปรียบเทียบสินค้าคงคลังกับยอดจองคงค้าง", // TODO(my)
  "chart.productMixTitle": "สัดส่วนยอดขายตามกลุ่มสินค้า", // TODO(my)
  "chart.productMixDescription": "สัดส่วนจำนวนขายของแต่ละกลุ่มสินค้า", // TODO(my)
  "chart.agingRiskTitle": "ความเสี่ยงจากอายุสต็อก", // TODO(my)
  "chart.agingRiskDescription": "การกระจุกตัวของสินค้าคงคลัง แยกตามกลุ่มสินค้าและช่วงอายุ", // TODO(my)
  "chart.stockProductAnalysisTitle": "สัดส่วนสินค้าคงคลัง", // TODO(my)
  "chart.stockProductAnalysisDescription": "สัดส่วนจำนวนสินค้าคงคลังของแต่ละกลุ่มสินค้า", // TODO(my)
  "chart.agedModelTitle": "รุ่นสินค้าที่มีอายุสต็อกสูงสุด", // TODO(my)
  "chart.agedModelDescription": "อายุสต็อกเฉลี่ย โดยเส้นประคือเกณฑ์ความเสี่ยง 90 วัน", // TODO(my)
  "chart.stockAgingMatrixTitle": "การกระจุกตัวของอายุสต็อก", // TODO(my)
  "chart.stockAgingMatrixDescription": "แสดงจำนวนสินค้าของแต่ละรุ่น แยกตามช่วงอายุสต็อก", // TODO(my)
  "chart.bookingStatusTitle": "สัดส่วนสถานะการจอง", // TODO(my)
  "chart.bookingStatusDescription": "จำนวนและสัดส่วนยอดจองในแต่ละสถานะตามตัวกรองที่เลือก", // TODO(my)
  "chart.branchBookingRiskTitle": "ความเสี่ยงยอดจองรายสาขา", // TODO(my)
  "chart.branchBookingRiskDescription": "ยอดจองคงค้างรายสาขา โดยสีแดงคือรายการวิกฤตเกิน 90 วัน", // TODO(my)
  "chart.bookingBreakdownTitle": "5 อันดับยอดจอง", // TODO(my)
  "chart.bookingBreakdownDescription": "เลือกวิเคราะห์ตามกลุ่มสินค้า รุ่น พนักงานขาย หรือประเภทการชำระเงิน", // TODO(my)
  "chart.bookingAgingMatrixTitle": "การกระจุกตัวของอายุการจอง", // TODO(my)
  "chart.bookingAgingMatrixDescription": "แสดงยอดจองคงค้างของแต่ละรุ่น แยกตามช่วงอายุการจอง", // TODO(my)
  "chart.managementFollowUpTitle": "รายการที่ผู้บริหารควรติดตาม", // TODO(my)
  "chart.managementFollowUpDescription": "ข้อเสนอแนะจากข้อมูลตามตัวกรองปัจจุบัน", // TODO(my)
  "chart.salesByBranchTitle": "ยอดขายรายสาขา", // TODO(my)
  "chart.salesByBranchDescription": "เรียงอันดับสาขาตามจำนวนขาย", // TODO(my)
  "chart.salespersonConcentrationTitle": "การกระจุกตัวของผลงานพนักงานขาย", // TODO(my)
  "chart.salespersonConcentrationDescription": "เรียงอันดับจำนวนขายพร้อมสัดส่วนสะสม", // TODO(my)
  "chart.salesProductGroupTitle": "สัดส่วนยอดขายตามกลุ่มสินค้า", // TODO(my)
  "chart.salesProductGroupDescription": "สัดส่วนจำนวนขายของแต่ละกลุ่มสินค้า", // TODO(my)
  "chart.topModelTitle": "รุ่นสินค้าขายดี", // TODO(my)
  "chart.topModelDescription": "เรียงอันดับรุ่นสินค้าตามจำนวนขาย", // TODO(my)
  "status.healthy": "ปกติ", // TODO(my)
  "status.watch": "เฝ้าระวัง", // TODO(my)
  "status.atRisk": "เสี่ยง", // TODO(my)
  "status.critical": "วิกฤต", // TODO(my)
  "status.open": "รอดำเนินการ", // TODO(my)
  "status.delivered": "ส่งมอบแล้ว", // TODO(my)
  "status.cancelled": "ยกเลิก", // TODO(my)
  "booking.depositNotSplit": "ยังไม่มีข้อมูลเงินมัดจำแยกตามช่วงอายุการจอง", // TODO(my)
  "booking.escalate": "เร่งติดตาม", // TODO(my)
  "booking.noCriticalFollowUp": "ไม่พบยอดจองคงค้างเกิน 90 วันตามตัวกรองปัจจุบัน", // TODO(my)
  "dashboard.attentionTitle": "ประเด็นที่ต้องติดตาม", // TODO(my)
  "dashboard.attentionDescription": "รายการตามบริษัทและตัวกรองปัจจุบัน", // TODO(my)
  "dashboard.liveScope": "ข้อมูลปัจจุบัน", // TODO(my)
  "dashboard.openBookingsReview": "ยอดจองคงค้างที่ต้องติดตาม", // TODO(my)
  "dashboard.bookingUnitsInScope": "คันในขอบเขตข้อมูล", // TODO(my)
  "dashboard.agedStockReview": "สต็อกค้างเกิน 90 วัน", // TODO(my)
  "dashboard.stockUnitsReview": "คันที่ควรตรวจสอบ", // TODO(my)
  "dashboard.sourceFreshness": "เวลาปรับปรุงข้อมูล", // TODO(my)
  "dashboard.updatedAt": "ปรับปรุงเมื่อ", // TODO(my)
  "dashboard.stockHealthTitle": "สถานะอายุสต็อก", // TODO(my)
  "dashboard.stockHealthDescription": "จำนวนสินค้าคงคลัง แยกตามช่วงอายุ", // TODO(my)
  "dashboard.quickActionsTitle": "เมนูลัด", // TODO(my)
  "dashboard.quickActionsDescription": "ดำเนินงานต่อในบริษัทปัจจุบัน", // TODO(my)
  "dashboard.uploadData": "อัปโหลดข้อมูล", // TODO(my)
  "dashboard.exportActivity": "ส่งออกรายการ", // TODO(my)
  "dashboard.askKai": "ถาม KAI", // TODO(my)
  "dashboard.checkDataQuality": "ตรวจคุณภาพข้อมูล", // TODO(my)
  "dashboard.recentActivityTitle": "รายการดำเนินงานล่าสุด", // TODO(my)
  "dashboard.recentActivityDescription": "ข้อมูลยอดขาย การจอง และการตลาดล่าสุดตามตัวกรองปัจจุบัน", // TODO(my)
  "dashboard.noRecentActivity": "ไม่พบรายการล่าสุดตามตัวกรองที่เลือก", // TODO(my)
  "sales.targetNotConfigured": "ยังไม่ได้กำหนดเป้าหมาย", // TODO(my)
  "sales.targetMet": "ทำได้ตามเป้าหมาย", // TODO(my)
  "sales.belowTarget": "ต่ำกว่าเป้าหมาย", // TODO(my)
  "sales.targetProgress": "ความคืบหน้าเทียบเป้าหมาย", // TODO(my)
  "sales.monthlyUnitPlan": "เป้าหมายจำนวนขายรายเดือน", // TODO(my)
  "sales.target": "เป้าหมาย", // TODO(my)
  "sales.actual": "ผลงานจริง", // TODO(my)
  "sales.remaining": "ยอดที่เหลือจากเป้าหมาย", // TODO(my)
  "sales.transactionTableTitle": "รายละเอียดรายการขาย", // TODO(my)
  "sales.transactionTableDescription": "ข้อมูลรายการขายจากต้นทางตามตัวกรองที่เลือก", // TODO(my)
  "booking.toDelivered": "ยอดจอง → ส่งมอบ", // TODO(my)
  "stock.coverageFormula": "สต็อก ÷ ยอดจอง", // TODO(my)
  "stock.openBookingUnits": "คันที่ยังรอส่งมอบ", // TODO(my)
  "stock.filteredInventory": "ของสินค้าตามตัวกรอง", // TODO(my)
  "stock.noOpenBooking": "ไม่มียอดจองคงค้าง", // TODO(my)
  "stock.noFilteredStock": "ไม่พบสินค้าตามตัวกรอง", // TODO(my)
  "stock.validMsrp": "เฉพาะกลุ่มสินค้าที่มีราคามาตรฐาน (MSRP)", // TODO(my)
  "stock.trendWithheld": "ยังไม่แสดงแนวโน้มสต็อก เพราะต้องมีข้อมูลอย่างน้อย 8 ช่วงเวลาจึงจะวิเคราะห์ได้อย่างน่าเชื่อถือ", // TODO(my)
  "stock.ninetyDayThreshold": "เกณฑ์ความเสี่ยง 90 วัน", // TODO(my)
  "stock.detailTitle": "รายละเอียดสินค้าคงคลัง", // TODO(my)
  "booking.detailTitle": "รายละเอียดยอดจอง", // TODO(my)
  "language.thai": "ไทย",
  "language.english": "English",
  "language.myanmar": "မြန်မာ",
  "language.select": "ဘာသာစကား ရွေးရန်",
  "metric.salesUnit": "Sales Unit",
  "metric.salesValue": "Sales Value",
  "metric.gp": "GP",
  "metric.gpValue": "GP Value",
  "metric.gpPercent": "GP %",
  "metric.booking": "Booking",
  "metric.bookingUnit": "Booking Unit",
  "metric.bookingValue": "Booking Value",
  "metric.installedBase": "Installed Base",
  "metric.marketingActivity": "Marketing Activity",
  "metric.marketingActivities": "Marketing Activities",
  "metric.showroom": "Showroom",
  "metric.achievement": "Achievement",
  "metric.activities": "Activities",
  "period.time": "ကာလ",
  "period.compare": "နှိုင်းယှဉ်ရန်",
  "period.from": "မှ",
  "period.to": "အထိ",
  "period.thisMonth": "ယခုလ",
  "period.previousMonth": "ယခင်လ",
  "period.thisQuarter": "ယခု သုံးလပတ်",
  "period.previousQuarter": "ယခင် သုံးလပတ်",
  "period.thisYear": "ယခုနှစ်",
  "period.ytd": "နှစ်အစမှ ယနေ့အထိ (YTD)",
  "period.rolling12Months": "နောက်ဆုံး ၁၂ လ",
  "period.customDateRange": "ရက်စွဲကာလ သတ်မှတ်ရန်",
  "comparison.title": "နှိုင်းယှဉ်မှု",
  "comparison.none": "မနှိုင်းယှဉ်ပါ",
  "comparison.previousPeriod": "ယခင်ကာလ",
  "comparison.samePeriodLastYear": "ယမန်နှစ် အလားတူကာလ",
  "comparison.previousYear": "ယခင်နှစ်",
  "comparison.custom": "စိတ်ကြိုက် နှိုင်းယှဉ်မှု",
  "comparison.shortage": "ขาด", // TODO(my)
  "comparison.surplus": "เกิน", // TODO(my)
  "comparison.balanced": "พอดี", // TODO(my)
  "legend.title": "အရောင် ရှင်းလင်းချက်",
  "legend.veryLow": "အလွန်နိမ့်",
  "legend.low": "နိမ့်",
  "legend.medium": "အလယ်အလတ်",
  "legend.high": "မြင့်",
  "legend.veryHigh": "အလွန်မြင့်",
  "map.metric": "Metric",
  "map.unableToLoad": "Interactive map ကို load မလုပ်နိုင်သဖြင့် အရန် map ကို ပြသထားပါသည်။",
  "panel.territory": "အရောင်းနယ်မြေ",
  "panel.installedBase": "Installed Base",
  "panel.salesPerformance": "Sales Performance",
  "panel.period": "ကာလ",
  "panel.salesBreakdown": "Sales Breakdown",
  "panel.noInstalledBaseProductDetail": "Installed Base ထုတ်ကုန်အသေးစိတ် မရှိပါ",
  "panel.noSelectedPeriodSalesProductDetail": "ရွေးထားသောကာလအတွက် Sales product data မရှိပါ",
  "panel.lastActivityDate": "နောက်ဆုံး Activity ရက်စွဲ",
  "panel.mostRecentActivity": "နောက်ဆုံး Activity",
  "panel.activityDensity": "Activity Density",
  "panel.topActivityType": "ထိပ်တန်း Activity အမျိုးအစား",
  "panel.noMarketingActivity": "ရွေးထားသောကာလတွင် Marketing activity မရှိပါ",
  "panel.noBookingData": "Booking data မရှိပါ",
  "panel.topModels": "Top Models",
  "panel.rankedBy": "အဆင့်သတ်မှတ်ချက်",
  "panel.noModelData": "Model data မရှိပါ",
  "panel.salesperson": "Salesperson",
  "panel.topBySalesUnit": "Sales Unit အလိုက် ထိပ်တန်း",
  "panel.noSalespersonData": "Salesperson data မရှိပါ",
  "panel.dataQuality": "Data quality",
  "panel.sourceRecord": "မူရင်း record",
  "panel.sourceRecords": "မူရင်း records",
  "panel.couldNotAssign": "ဤ Township သို့ သတ်မှတ်၍မရပါ။",
  "debug.title": "Debug အချက်အလက်",
  "daily.input.title": "နေ့စဉ် စီမံခန့်ခွဲမှု အပ်ဒိတ်",
  "daily.input.subtitle": "နေ့စဉ်စီမံခန့်ခွဲမှု data ကိုသာ ဖြည့်ပါ။ Sales, Booking နှင့် Stock ကို Data Hub မှ အလိုအလျောက် ရယူပါမည်။",
  "daily.reportInfo": "Report အချက်အလက်",
  "daily.reportInfoDescription": "ယနေ့ report အတွက် ရက်စွဲနှင့် branch scope ကို သတ်မှတ်ပါ",
  "daily.actions": "Action Required",
  "daily.actionsDescription": "ပိုင်ရှင်နှင့် follow-up လိုသော ကိစ္စများကိုသာ ထည့်ပါ",
  "daily.addAction": "Action ထည့်ရန်",
  "daily.notes": "Management Notes",
  "daily.notesDescription": "တစ်ကြောင်းလျှင် အကြောင်းအရာတစ်ခု ရေးပါ။ Report တွင် bullet အဖြစ်ပြပါမည်။",
  "daily.importExcel": "Excel မှ Import",
  "daily.publishReport": "Report Publish လုပ်ရန်",
  "daily.back": "နေ့စဉ် Report",
  "daily.openDataHub": "Data Hub ဖွင့်ရန်",
  "daily.webForm": "Web form · အကြံပြု",
  "daily.webFormDescription": "D1 သို့ တိုက်ရိုက်သိမ်းပြီး data အမှားနှင့် ထပ်နေမှုကို လျှော့ချပေးသည်။",
  "daily.synced": "Draft sync ပြီးပါပြီ",
  "daily.notSaved": "D1 တွင် မသိမ်းရသေးပါ",
  "daily.unsaved": "မသိမ်းရသေးသော ပြောင်းလဲမှုများ",
  "daily.reportDate": "Report ရက်စွဲ",
  "daily.branch": "Branch",
  "daily.preparedBy": "ပြင်ဆင်သူ",
  "daily.mtdTarget": "MTD Target",
  "daily.expectedPace": "Expected Pace",
  "daily.lifecycleAutomatic": "Approved monthly target ကို အလိုအလျောက် load လုပ်ပါသည်။ Canonical status events မရှိသေးသဖြင့် Booking lifecycle totals ကို မပြသသေးပါ။",
  "daily.priority": "ဦးစားပေးအဆင့်",
  "daily.issue": "ကိစ္စ",
  "daily.detail": "အသေးစိတ်",
  "daily.owner": "တာဝန်ရှိသူ",
  "daily.nextStep": "နောက်တစ်ဆင့်",
  "daily.noActions": "ယနေ့ Action မရှိပါ",
  "daily.noActionsDescription": "အမှန်တကယ် follow-up လိုသော အကြောင်းအရာများကိုသာ ထည့်ပါ။",
  "daily.situation": "ယနေ့ အခြေအနေ",
  "daily.decision": "Management decision",
  "daily.tomorrow": "မနက်ဖြန် ဦးစားပေး",
  "daily.excelAlternative": "Data အများအပြား ဖြည့်ရန် အခြားရွေးချယ်စရာ",
  "daily.templateOnly": "KMM Daily Management Template ကိုသာ သုံးပါ။ Sales, Booking နှင့် Stock ဖိုင်များကို Data Hub တွင် upload လုပ်ပါ။",
  "daily.downloadTemplate": "Template Download",
  "daily.dropExcel": "Excel ဖိုင်ကို ဤနေရာတွင် ထည့်ပါ",
  "daily.chooseFile": "ဖိုင်ရွေးရန်",
  "daily.replaceFile": "ဖိုင်ပြောင်းရန်",
  "dataHub.smartImport": "Smart Import",
  "dataHub.smartImportDescription": "Excel ဖိုင်တစ်ဖိုင် ထည့်ပါ။ ဖိုင်အမျိုးအစားကို စစ်ဆေးပြီး data ကို validate လုပ်ကာ Import အတွက် ပြင်ဆင်ပေးပါမည်။",
  "dataHub.history": "Import မှတ်တမ်း",
  "dataHub.upload": "Data ဖိုင် Upload",
  "dataHub.uploadDescription": "Auto detect ကို default သုံးထားပြီး upload ပြီးနောက် ဖိုင်အမျိုးအစားကို အတည်ပြု သို့မဟုတ် ပြောင်းနိုင်သည်။",
  "dataHub.drop": "Excel ဖိုင်ကို ဤနေရာတွင် ထည့်ပါ",
  "dataHub.browse": "ဖိုင်ရွေးရန်",
  "settings.overview": "Settings အကျဉ်းချုပ်",
  "settings.overviewDescription": "Enterprise configuration ကို စီမံရန်",
  "expense.emptyTitle": "အသုံးစရိတ် Data မရှိသေးပါ",
  "expense.emptyDescription": "အတည်ပြုပြီးသော financial data source ချိတ်ဆက်ပြီးနောက် expense metrics, budget comparisons, trends နှင့် အသေးစိတ်များကို ပြသပါမည်။",
  "login.subtitle": "Enterprise account ဖြင့် ဝင်ရောက်ပါ။",
  "login.password": "Password",
  "login.passwordPlaceholder": "Password ထည့်ပါ",
  "login.remember": "Login ကို မှတ်ထားရန်",
  "login.submit": "ဝင်ရောက်ရန်",
  "login.signingIn": "ဝင်ရောက်နေသည်",
  "login.checking": "Login အခြေအနေ စစ်ဆေးနေသည်...",
  "login.loadingDashboard": "Secure Dashboard ကို load လုပ်နေသည်...",
  "login.showPassword": "Password ပြရန်",
  "login.hidePassword": "Password ဖျောက်ရန်",
  "login.success": "ဝင်ရောက်ပြီးပါပြီ။ ယခင်စာမျက်နှာသို့ ပြန်နေသည်...",
  "login.invalid": "Email သို့မဟုတ် Password မမှန်ပါ။",
  "login.tooMany": "Login ကြိုးစားမှု များလွန်းသည်။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။",
  "login.failed": "ဝင်ရောက်၍မရပါ။ အချက်အလက်ကို စစ်ပြီး ထပ်ကြိုးစားပါ။",
};

export default my;
