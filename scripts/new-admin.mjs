// 生成站长账号的初始凭证，供部署后写入 app.admin_account 表使用。
// 用法：node scripts/new-admin.mjs <用户名> [密码]
// 不传密码时会生成一个随机强密码，请在意的一次性输出中妥善保存。
import { randomInt } from 'node:crypto';
import { makeCredential } from '../functions/routes.mjs';

const words = ['Harvest', 'Lantern', 'Meadow', 'Falcon', 'Copper', 'Willow', 'Harbor', 'Summit'];
const pick = () => words[randomInt(words.length)];

function randomPassword() {
  const digits = String(randomInt(100, 999));
  const symbol = '!@#%&*'[randomInt(6)];
  return `${pick()}${pick()}-${digits}${symbol}`;
}

const username = (process.argv[2] || '').trim().toLowerCase();
const password = (process.argv[3] || '').trim() || randomPassword();

if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error('用户名需为 3-40 位小写字母、数字或 . _ -');
  process.exit(1);
}
if (password.length < 8) {
  console.error('密码至少 8 位');
  process.exit(1);
}

const credential = await makeCredential(password);

console.log(`用户名：${username}`);
console.log(`初始密码：${password}`);
console.log('');
console.log('把下面的值写入 app.admin_account（首次登录会强制改密）：');
console.log('');
console.log(`id              owner`);
console.log(`username        ${username}`);
console.log(`password_hash   ${credential.hash}`);
console.log(`password_salt   ${credential.salt}`);
console.log(`iterations      ${credential.iterations}`);
console.log(`must_change     true`);
console.log('');
console.log('提示：密码只显示这一次，请立即保存；泄露时重新生成并更新该行即可。');
