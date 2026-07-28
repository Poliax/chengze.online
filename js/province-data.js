/**
 * 承泽教育 — 省份/类别/科目数据
 */

const PROVINCE_DATA = {
  zhejiang: {
    name: '浙江',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '医学综合'], total: 350 },
      { id: 'yishu', name: '艺术类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'nonglin', name: '农林类', subjects: ['高等数学', '大学英语'], total: 300 },
    ]
  },
  shandong: {
    name: '山东',
    categories: [
      { id: 'ligong1', name: '理工类', subjects: ['高等数学Ⅰ', '大学英语', '计算机'], total: 400 },
      { id: 'jingguan2', name: '经管类', subjects: ['高等数学Ⅱ', '大学英语', '计算机'], total: 400 },
      { id: 'wenshi3', name: '文史类', subjects: ['高等数学Ⅲ', '大学英语', '计算机'], total: 400 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学Ⅱ', '大学英语', '计算机', '医学综合'], total: 450 },
      { id: 'yishu', name: '艺术类', subjects: ['高等数学Ⅲ', '大学英语', '计算机'], total: 400 },
    ]
  },
  henan: {
    name: '河南',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语', '管理学'], total: 350 },
      { id: 'yixue', name: '医学类', subjects: ['生理学与病理解剖学', '大学英语'], total: 300 },
      { id: 'yishu', name: '艺术类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'tiyu', name: '体育类', subjects: ['大学语文', '大学英语', '体育专业综合'], total: 350 },
    ]
  },
  guangdong: {
    name: '广东',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语', '政治理论'], total: 450 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语', '政治理论'], total: 450 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语', '政治理论'], total: 450 },
      { id: 'yixue', name: '医学类', subjects: ['生理学', '大学英语', '政治理论'], total: 450 },
      { id: 'yishu', name: '艺术类', subjects: ['艺术概论', '大学英语', '政治理论'], total: 450 },
    ]
  },
  jiangsu: {
    name: '江苏',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语', '计算机'], total: 400 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语', '计算机'], total: 400 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语', '计算机'], total: 400 },
      { id: 'yixue', name: '医护类', subjects: ['高等数学', '大学英语', '计算机', '医护综合'], total: 450 },
    ]
  },
  sichuan: {
    name: '四川',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语', '计算机'], total: 450 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语', '计算机'], total: 450 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语', '计算机'], total: 450 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '计算机', '医学综合'], total: 500 },
      { id: 'waiyu', name: '外语类', subjects: ['大学语文', '大学英语', '计算机'], total: 450 },
    ]
  },
  fujian: {
    name: '福建',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '医学基础'], total: 400 },
      { id: 'yishu', name: '艺术类', subjects: ['大学语文', '大学英语'], total: 300 },
    ]
  },
  hunan: {
    name: '湖南',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语', '管理学'], total: 350 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '医学综合'], total: 350 },
      { id: 'nonglin', name: '农林类', subjects: ['高等数学', '大学英语', '植物学'], total: 350 },
    ]
  },
  anhui: {
    name: '安徽',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语', '管理学'], total: 350 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '医学综合'], total: 350 },
      { id: 'yishu', name: '艺术类', subjects: ['大学语文', '大学英语', '艺术概论'], total: 350 },
    ]
  },
  shaanxi: {
    name: '陕西',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '医学综合'], total: 350 },
      { id: 'yishu', name: '艺术类', subjects: ['大学语文', '大学英语'], total: 300 },
    ]
  },
  hubei: {
    name: '湖北',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语', '管理学'], total: 350 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '医学综合'], total: 400 },
      { id: 'nonglin', name: '农林类', subjects: ['高等数学', '大学英语'], total: 300 },
    ]
  },
  jiangxi: {
    name: '江西',
    categories: [
      { id: 'ligong', name: '理工类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'wenshi', name: '文史类', subjects: ['大学语文', '大学英语'], total: 300 },
      { id: 'jingguan', name: '经管类', subjects: ['高等数学', '大学英语'], total: 300 },
      { id: 'yixue', name: '医学类', subjects: ['高等数学', '大学英语', '医学综合'], total: 350 },
      { id: 'yishu', name: '艺术类', subjects: ['大学语文', '大学英语'], total: 300 },
    ]
  },
};


// 考试日程数据（各省）


// 各省班型配置
const PROVINCE_CLASSES = {
  zhejiang: [
    { name: '卓越班', tag: '系统班', price: '¥2,280', duration: '6个月', sessions: 120, tagColor: '#2d5f6e' },
    { name: '自强班', tag: '基础班', price: '¥1,280', duration: '4个月', sessions: 80, tagColor: '#7c3aed' },
    { name: '冲刺班', tag: '考前班', price: '¥2,800', duration: '2个月', sessions: 40, tagColor: '#f59e0b' },
    { name: 'VIP班', tag: '全程班', price: '¥12,800', duration: '12个月', sessions: 240, tagColor: '#dc2626' },
  ],
  shandong: [
    { name: '卓越班', tag: '系统班', price: '¥2,280', duration: '6个月', sessions: 130, tagColor: '#2d5f6e' },
    { name: '自强班', tag: '基础班', price: '¥1,280', duration: '4个月', sessions: 90, tagColor: '#7c3aed' },
    { name: '冲刺班', tag: '考前班', price: '¥3,200', duration: '2个月', sessions: 45, tagColor: '#f59e0b' },
    { name: 'VIP协议班', tag: '保过班', price: '¥15,800', duration: '12个月', sessions: 280, tagColor: '#dc2626' },
  ],
  henan: [
    { name: '卓越班', tag: '系统班', price: '¥2,280', duration: '6个月', sessions: 110, tagColor: '#2d5f6e' },
    { name: '自强班', tag: '基础班', price: '¥1,280', duration: '4个月', sessions: 75, tagColor: '#7c3aed' },
    { name: '冲刺班', tag: '考前班', price: '¥2,500', duration: '2个月', sessions: 35, tagColor: '#f59e0b' },
  ],
  guangdong: [
    { name: '卓越班', tag: '系统班', price: '¥2,280', duration: '6个月', sessions: 135, tagColor: '#2d5f6e' },
    { name: '自强班', tag: '基础班', price: '¥1,280', duration: '4个月', sessions: 90, tagColor: '#7c3aed' },
    { name: '冲刺班', tag: '考前班', price: '¥3,500', duration: '2个月', sessions: 40, tagColor: '#f59e0b' },
    { name: 'VIP班', tag: '全程班', price: '¥13,800', duration: '12个月', sessions: 260, tagColor: '#dc2626' },
  ],
};

// Default classes for provinces without specific config
PROVINCE_CLASSES.default = [
  { name: '卓越班', tag: '系统班', price: '¥2,280', duration: '6个月', sessions: 120, tagColor: '#2d5f6e' },
  { name: '自强班', tag: '基础班', price: '¥1,280', duration: '4个月', sessions: 80, tagColor: '#7c3aed' },
  { name: '冲刺班', tag: '考前班', price: '¥2,800', duration: '2个月', sessions: 40, tagColor: '#f59e0b' },
];

const EXAM_SCHEDULE = {
  zhejiang: [
    { month: '1月', event: '考试大纲发布', desc: '浙江省教育考试院发布当年专升本招生工作通知及考试大纲' },
    { month: '2月', event: '网上报名', desc: '登录浙江省教育考试院网站进行网上报名和志愿填报' },
    { month: '3月', event: '资格审核', desc: '所在高校对报名考生进行资格审核' },
    { month: '3月', event: '准考证打印', desc: '考前一周登录报名系统打印准考证' },
    { month: '4月', event: '全省统一考试', desc: '专升本考试（具体日期以准考证为准）' },
    { month: '5月', event: '成绩查询', desc: '登录浙江省教育考试院网站查询考试成绩' },
    { month: '5-6月', event: '录取查询', desc: '各高校陆续公布录取结果' },
    { month: '9月', event: '新生入学', desc: '被录取考生凭录取通知书到本科院校报到' },
  ],
  shandong: [
    { month: '11月', event: '考试要求发布', desc: '山东省教育招生考试院发布专升本公共基础课考试要求' },
    { month: '12月', event: '报名通知发布', desc: '发布普通专升本招生考试报名工作通知及报名问题解答' },
    { month: '12月', event: '网上报名', desc: '登录山东省教育招生考试院网站进行网上报名' },
    { month: '2月', event: '建档立卡公示', desc: '普通专升本建档立卡家庭考生资格名单公示' },
    { month: '3月', event: '准考证打印', desc: '考前登录系统打印准考证' },
    { month: '3月', event: '统一考试', desc: '山东省普通专升本统一考试' },
    { month: '4月', event: '成绩公布', desc: '登录考试院网站查询考试成绩' },
    { month: '4月', event: '志愿填报', desc: '普通专升本志愿填报及录取工作' },
    { month: '4月', event: '投档录取', desc: '投档情况统计表公布，各院校录取' },
    { month: '4-5月', event: '退役士兵免试公示', desc: '退役大学生士兵免试专升本资格名单公示' },
  ],
  henan: [
    { month: '10-11月', event: '信息采集', desc: '各高校组织专升本报名信息采集' },
    { month: '12月', event: '考试大纲公布', desc: '河南省教育考试院发布考试说明' },
    { month: '3月', event: '网上报名', desc: '登录河南省教育考试院网站报名' },
    { month: '4月', event: '统一考试', desc: '河南省专升本统一考试' },
    { month: '5月', event: '成绩查询', desc: '登录考试院网站查询成绩' },
    { month: '6月', event: '志愿填报', desc: '网上填报志愿' },
    { month: '7月', event: '录取查询', desc: '各高校公布录取结果' },
  ],
  guangdong: [
    { month: '1月', event: '网上预报名', desc: '登录广东省教育考试院网站进行预报名' },
    { month: '1月', event: '资料审核', desc: '上传相关资料进行线上审核' },
    { month: '2月', event: '确认报名', desc: '网上缴费确认报名' },
    { month: '3月', event: '准考证打印', desc: '考前打印准考证' },
    { month: '3月', event: '统一考试', desc: '广东省普通专升本招生考试' },
    { month: '5月', event: '成绩公布', desc: '查询考试成绩' },
    { month: '6月', event: '录取工作', desc: '各批次录取工作' },
  ],
};

// Default schedule for provinces without specific data
EXAM_SCHEDULE.default = [
  { month: '1-2月', event: '招生政策发布', desc: '各省教育考试院发布当年专升本招生政策' },
  { month: '2-3月', event: '网上报名', desc: '登录各省教育考试院网站进行报名' },
  { month: '3-4月', event: '资格审核', desc: '高校审核考生报名资格' },
  { month: '4-5月', event: '统一考试', desc: '各省专升本统一考试' },
  { month: '5-6月', event: '成绩查询', desc: '登录考试院网站查询成绩' },
  { month: '6-7月', event: '录取查询', desc: '各高校陆续公布录取结果' },
  { month: '9月', event: '新生入学', desc: '被录取考生到本科院校报到入学' },
];