const shippingRegions = require('../js/shipping-regions');
function accountDetails(body) {
  if (Object.prototype.hasOwnProperty.call(body, 'uid')) throw Error('UID 注册后不可修改');
  if (body.recipient_address_detail === undefined && body.recipient_address) throw Error('地址填写方式已更新，请刷新页面后保存');
  const fields = { nickname:30, recipient_name:50, recipient_phone:30, recipient_address_detail:300, recipient_province:6, recipient_city:6, recipient_district:12 };
  const values = {};
  for (const [key, max] of Object.entries(fields)) {
    const raw = body[key] === undefined && key.startsWith('recipient_') ? '' : body[key];
    if (typeof raw !== 'string') throw Error('请填写有效的个人信息');
    const value = raw.trim();
    if (value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw Error('填写内容过长或包含无效字符');
    values[key] = value;
  }
  values.name = body.name === undefined ? null : (typeof body.name === 'string' ? body.name.trim() : null);
  if (body.name !== undefined && (values.name === null || values.name.length > 50 || /[\x00-\x1f]/.test(values.name))) throw Error('请填写有效姓名');
  for (const field of ['junior_college','junior_major']) {
    values[field] = body[field] === undefined ? null : (typeof body[field] === 'string' ? body[field].trim() : null);
    if(body[field] !== undefined && (values[field] === null || values[field].length > 100 || /[\x00-\x1f]/.test(values[field]))) throw Error('院校及专业请填写100字以内的文字');
  }
  if (!values.nickname) throw Error('请填写昵称');
  const shipping = [values.recipient_name, values.recipient_phone, values.recipient_province, values.recipient_city, values.recipient_district, values.recipient_address_detail];
  if (shipping.some(Boolean) && !shipping.every(Boolean)) throw Error('请完整填写收货人、联系电话和地址');
  if (values.recipient_phone && !/^\+?[\d ()-]{6,30}$/.test(values.recipient_phone)) throw Error('请填写有效的联系电话');
  values.recipient_address = '';
  if (shipping.some(Boolean)) {
    const province=shippingRegions.find(p=>p.code===values.recipient_province);
    const city=province && province.children.find(c=>c.code===values.recipient_city);
    const district=city && city.children.find(d=>d.code===values.recipient_district);
    if(!district) throw Error('请选择有效的省、市、区县');
    values.recipient_address=[province.name,city.name,district.name,values.recipient_address_detail].join(' ');
  }
  return values;
}
function avatarExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.length > 2 * 1024 * 1024) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer[buffer.length-2] === 0xff && buffer[buffer.length-1] === 0xd9) return '.jpg';
  if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  return null;
}
function studyDetails(db,body) {
  if(body.province_code === undefined && body.exam_year === undefined) return {province_code:null,exam_year:null};
  if(typeof body.province_code !== 'string' || typeof body.exam_year !== 'string') throw Error('请选择考试省份和年份');
  const province=body.province_code.trim(),year=body.exam_year.trim();
  if(!province&&!year)return {province_code:'',exam_year:''};
  if(!province || !db.get('SELECT code FROM provinces WHERE code=?',[province]))throw Error('请选择有效考试省份');
  if(!/^20\d{2}$/.test(year))throw Error('请选择有效考试年份');
  return {province_code:province,exam_year:year};
}
module.exports = { accountDetails, avatarExtension, studyDetails };
