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
