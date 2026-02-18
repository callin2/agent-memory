// Test if we can import the orchestration routes
try {
  const { createOrchestrationRoutes } = await import('./dist/api/orchestration.js');
  console.log('✓ Orchestration routes imported successfully');
  console.log('Type:', typeof createOrchestrationRoutes);
} catch (error) {
  console.log('❌ Import failed:', error.message);
}
