#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import readline from 'node:readline';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function replaceInFile(filePath, oldValue, newValue) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const newContent = content.replaceAll(oldValue, newValue);
    if (content !== newContent) {
      await writeFile(filePath, newContent, 'utf-8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Yarn Workspace 모노레포 보일러플레이트 설정\n');

  const orgName = await question('조직명을 입력하세요 (예: mycompany): ');

  if (!orgName || !/^[a-z0-9-]+$/.test(orgName)) {
    console.error('❌ 유효한 조직명을 입력하세요 (소문자, 숫자, 하이픈만 가능)');
    rl.close();
    process.exit(1);
  }

  const newScope = `@${orgName}`;
  console.log(`\n📦 조직명을 @mono에서 ${newScope}로 변경합니다...\n`);

  // 변경할 파일 패턴
  const patterns = [
    'package.json',
    'packages/*/package.json',
    'apps/*/package.json',
    'apps/*/next.config.{js,ts}',
    'apps/*/src/**/*.{ts,tsx,js,jsx}',
    'packages/*/src/**/*.{ts,tsx,js,jsx}',
    'README.md',
    'biome.json',
    'tsconfig.json',
  ];

  let updatedCount = 0;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: rootDir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.yarn/**'],
      absolute: true,
    });

    for (const file of files) {
      const updated = await replaceInFile(file, '@mono', newScope);
      if (updated) updatedCount++;
    }
  }

  console.log(`\n✨ 완료! ${updatedCount}개 파일이 업데이트되었습니다.`);
  console.log(`\n다음 단계:`);
  console.log(`  1. yarn install`);
  console.log(`  2. git add .`);
  console.log(`  3. git commit -m "chore: update organization name to ${newScope}"`);
  console.log(`\n🎉 ${newScope} 모노레포가 준비되었습니다!\n`);

  rl.close();
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});

