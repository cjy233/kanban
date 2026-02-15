const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // 访问首页
  await page.goto('http://localhost:7777');
  await page.waitForTimeout(1000);
  
  // 截图首页
  await page.screenshot({ path: '/tmp/page1-dashboard.png' });
  console.log('截图1: 仪表盘页面');
  
  // 点击进程管理链接
  await page.click('a[href="/processes"]');
  
  // 等待动画开始（100ms）
  await page.waitForTimeout(100);
  await page.screenshot({ path: '/tmp/page2-transition.png' });
  console.log('截图2: 过渡动画中');
  
  // 等待动画完成
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/page3-processes.png' });
  console.log('截图3: 进程管理页面');
  
  // 返回仪表盘
  await page.click('a[href="/"]');
  await page.waitForTimeout(100);
  await page.screenshot({ path: '/tmp/page4-back-transition.png' });
  console.log('截图4: 返回过渡动画中');
  
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/page5-back-dashboard.png' });
  console.log('截图5: 返回仪表盘');
  
  await browser.close();
  console.log('测试完成');
})();
