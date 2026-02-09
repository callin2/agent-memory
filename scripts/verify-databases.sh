#!/bin/bash
# Database verification script
# Compares production and development databases

echo "==================================="
echo "Database Verification"
echo "==================================="
echo ""

# Get table counts
prod_count=$(psql agent_memory -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
dev_count=$(psql agent_memory_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo "Production Database (agent_memory): $prod_count tables"
echo "Development Database (agent_memory_dev): $dev_count tables"
echo ""

# Check if counts match
if [ "$prod_count" -eq "$dev_count" ]; then
    echo "✅ Table counts match!"
else
    echo "❌ Table counts differ!"
    exit 1
fi

# Get table lists
prod_tables=$(psql agent_memory -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" | tr '\n' ' ')
dev_tables=$(psql agent_memory_dev -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" | tr '\n' ' ')

echo ""
echo "Production tables:"
echo "$prod_tables"
echo ""
echo "Development tables:"
echo "$dev_tables"
echo ""

# Check if tables match
if [ "$prod_tables" = "$dev_tables" ]; then
    echo "✅ Database schemas are identical!"
else
    echo "❌ Database schemas differ!"
    echo ""
    echo "Tables only in production:"
    comm -23 <(echo "$prod_tables" | tr ' ' '\n' | sort) <(echo "$dev_tables" | tr ' ' '\n' | sort)
    echo ""
    echo "Tables only in development:"
    comm -13 <(echo "$prod_tables" | tr ' ' '\n' | sort) <(echo "$dev_tables" | tr ' ' '\n' | sort)
    exit 1
fi

echo ""
echo "==================================="
echo "Verification Complete: All Good! ✅"
echo "==================================="
