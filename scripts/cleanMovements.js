const { PrismaClient } = require('@prisma/client');

async function cleanMovements() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Conectando a la base de datos...');
    
    // Contar registros antes
    const before = await prisma.inventoryMovement.count();
    console.log(`📊 Total de movimientos antes: ${before}`);
    
    // Eliminar TODOS los movimientos
    const deleted = await prisma.inventoryMovement.deleteMany({
      where: {}
    });
    
    console.log(`✅ ${deleted.count} movimientos eliminados`);
    
    // Verificar después
    const after = await prisma.inventoryMovement.count();
    console.log(`📊 Total de movimientos después: ${after}`);
    
    if (after === 0) {
      console.log('🎉 ¡Base de datos limpia!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanMovements();
