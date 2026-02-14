import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: React.ReactNode
  description?: string
  color?: 'green' | 'yellow' | 'red' | 'blue'
}

const colorClasses = {
  green: 'text-green-600 bg-green-50 border-green-200',
  yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  red: 'text-red-600 bg-red-50 border-red-200',
  blue: 'text-blue-600 bg-blue-50 border-blue-200',
}

const iconColorClasses = {
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
}

export function MetricCard({
  title,
  value,
  unit,
  trend,
  trendValue,
  icon,
  description,
  color = 'blue',
}: MetricCardProps) {
  const trendIcon =
    trend === 'up' ? (
      <TrendingUp className="h-4 w-4" />
    ) : trend === 'down' ? (
      <TrendingDown className="h-4 w-4" />
    ) : (
      <Minus className="h-4 w-4" />
    )

  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'

  return (
    <Card className={`transition-all hover:shadow-md ${colorClasses[color]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className={iconColorClasses[color]}>{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold">
            {value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
              {trendIcon}
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
