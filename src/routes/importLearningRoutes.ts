import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

const router = Router();

interface ImportPattern {
  excelSignature: string;
  columnMapping: any;
  brandCategoryConfig: any;
  advancedConfig: any;
  successCount: number;
  failureCount: number;
}

// Obtener recomendaciones basadas en patrones similares
router.post('/recommendations', authenticate, async (req: Request, res: Response) => {
  try {
    const { excelSignature, columns } = req.body;

    // Buscar patrones similares en la base de datos
    const similarPatterns = await prisma.$queryRaw<ImportPattern[]>`
      SELECT 
        excel_signature as "excelSignature",
        column_mapping as "columnMapping",
        brand_category_config as "brandCategoryConfig",
        advanced_config as "advancedConfig",
        success_count as "successCount",
        failure_count as "failureCount"
      FROM import_patterns
      WHERE excel_signature LIKE ${'%' + excelSignature + '%'}
      ORDER BY (success_count * 2 - failure_count) DESC
      LIMIT 5
    `;

    if (similarPatterns.length > 0) {
      const bestPattern = similarPatterns[0];
      const totalUses = bestPattern.successCount + bestPattern.failureCount;
      const confidence = Math.round((bestPattern.successCount / totalUses) * 100);

      return res.json({
        recommendation: {
          confidence,
          basedOnImports: bestPattern.successCount,
          suggestedMapping: bestPattern.columnMapping,
          suggestedBrandCategory: bestPattern.brandCategoryConfig,
          usedByUsers: Math.floor(totalUses / 3), // Aproximado
          reason: `Basado en ${bestPattern.successCount} importaciones exitosas con estructura similar (${confidence}% de éxito)`
        }
      });
    }

    return res.json({ recommendation: null });
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    return res.json({ recommendation: null });
  }
});

// Guardar patrón de importación exitosa
router.post('/record', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      excelSignature, 
      columnMapping, 
      brandCategoryConfig, 
      advancedConfig,
      success,
      totalProducts 
    } = req.body;

    // Verificar si ya existe el patrón
    const existing = await prisma.$queryRaw<ImportPattern[]>`
      SELECT * FROM import_patterns 
      WHERE excel_signature = ${excelSignature}
      AND user_id = ${req.user?.id}
    `;

    if (existing.length > 0) {
      // Actualizar patrón existente
      await prisma.$executeRaw`
        UPDATE import_patterns 
        SET success_count = success_count + ${success ? 1 : 0},
            failure_count = failure_count + ${success ? 0 : 1},
            last_used = NOW(),
            column_mapping = ${JSON.stringify(columnMapping)},
            brand_category_config = ${JSON.stringify(brandCategoryConfig)},
            advanced_config = ${JSON.stringify(advancedConfig)}
        WHERE excel_signature = ${excelSignature}
        AND user_id = ${req.user?.id}
      `;
    } else {
      // Crear nuevo patrón
      await prisma.$executeRaw`
        INSERT INTO import_patterns (
          user_id,
          excel_signature,
          column_mapping,
          brand_category_config,
          advanced_config,
          success_count,
          failure_count,
          created_at,
          last_used
        ) VALUES (
          ${req.user?.id},
          ${excelSignature},
          ${JSON.stringify(columnMapping)},
          ${JSON.stringify(brandCategoryConfig)},
          ${JSON.stringify(advancedConfig)},
          ${success ? 1 : 0},
          ${success ? 0 : 1},
          NOW(),
          NOW()
        )
      `;
    }

    // Guardar en historial
    await prisma.$executeRaw`
      INSERT INTO import_history (
        user_id,
        excel_signature,
        total_products,
        success_products,
        failed_products,
        configuration_used,
        created_at
      ) VALUES (
        ${req.user?.id},
        ${excelSignature},
        ${totalProducts},
        ${success ? totalProducts : 0},
        ${success ? 0 : totalProducts},
        ${JSON.stringify({ columnMapping, brandCategoryConfig, advancedConfig })},
        NOW()
      )
    `;

    return res.json({ success: true });
  } catch (error) {
    logger.error('Error recording import pattern:', error);
    return res.status(500).json({ error: 'Error recording pattern' });
  }
});

// Estadísticas de aprendizaje del usuario
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT excel_signature) as unique_patterns,
        SUM(success_count) as total_successful_imports,
        SUM(failure_count) as total_failed_imports,
        AVG(CASE WHEN success_count + failure_count > 0 
            THEN (success_count::float / (success_count + failure_count)) * 100 
            ELSE 0 END) as average_success_rate
      FROM import_patterns
      WHERE user_id = ${req.user?.id}
    `;

    return res.json({ stats: stats[0] });
  } catch (error) {
    logger.error('Error getting stats:', error);
    return res.status(500).json({ error: 'Error getting stats' });
  }
});

export default router;
