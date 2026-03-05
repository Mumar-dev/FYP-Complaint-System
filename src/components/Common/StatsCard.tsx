import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  textColor?: string;
  change?: string;
}

/**
 * Dashboard statistics card component.
 * Shows metric value with icon and optional change indicator.
 */
const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon: Icon,
  color = 'bg-blue-100',
  textColor = 'text-blue-700',
  change,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        {change && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
};

export default StatsCard;
