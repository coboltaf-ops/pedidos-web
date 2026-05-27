import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('🚀 PRUEBA FINAL END-TO-END EN LOCALHOST\n');

    // 1. Acceder a página
    console.log('1️⃣ Navegando a localhost...');
    await page.goto('http://localhost:3000/inventario-comidas/clientes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('   ✅ Página cargó sin errores');

    // 2. Contar clientes iniciales
    const initialCount = await page.locator('table tbody tr').count();
    console.log(`   📊 Clientes iniciales: ${initialCount}`);

    // 3. Crear cliente
    console.log('\n2️⃣ Creando nuevo cliente...');
    const nombre = `FINAL_TEST_${Date.now()}`;
    const email = `final${Date.now()}@test.com`;
    const doc = `${Date.now()}`.slice(-10);

    await page.locator('button:has-text("Registro de Cliente")').click();
    await page.waitForTimeout(1000);

    // Llenar formulario
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length > 1) {
      await inputs[0].fill(nombre);
      await inputs[1].fill(doc);
    }
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="tel"]', '3001234567');

    // Guardar
    const dialogPromise = page.waitForEvent('dialog');
    await page.locator('button:has-text("GUARDAR")').click();
    const dialog = await dialogPromise;
    console.log(`   Respuesta: ${dialog.message()}`);
    await dialog.accept();
    await page.waitForTimeout(2000);

    // 4. Verificar en tabla
    console.log('\n3️⃣ Verificando en tabla...');
    const finalCount = await page.locator('table tbody tr').count();
    if (finalCount > initialCount) {
      console.log(`   ✅ Cliente agregado (${initialCount} → ${finalCount})`);
    } else {
      console.log(`   ❌ Cliente NO se agregó`);
      await browser.close();
      process.exit(1);
    }

    // 5. Esperar polling (5-7 segundos)
    console.log('\n4️⃣ Esperando polling (5-7s)...');
    await page.waitForTimeout(7000);
    const persistCount = await page.locator('table tbody tr').count();
    if (persistCount === finalCount) {
      console.log(`   ✅ Cliente persiste después del polling`);
    } else {
      console.log(`   ❌ Cliente desapareció (${finalCount} → ${persistCount})`);
      await browser.close();
      process.exit(1);
    }

    // 6. Recargar página
    console.log('\n5️⃣ Recargando página...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 7. Verificar persistencia
    const reloadCount = await page.locator('table tbody tr').count();
    if (reloadCount === persistCount) {
      console.log(`   ✅ Cliente persiste después de reload`);
    } else {
      console.log(`   ❌ Cliente se perdió en reload (${persistCount} → ${reloadCount})`);
      await browser.close();
      process.exit(1);
    }

    console.log('\n🎉 TODAS LAS PRUEBAS PASARON\n');
    console.log('El sistema está funcionando correctamente:');
    console.log('✅ Creación de clientes');
    console.log('✅ Visualización en tabla');
    console.log('✅ Persistencia con polling');
    console.log('✅ Persistencia después de reload');

    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    await browser.close();
    process.exit(1);
  }
}

test();
