import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'amber' | 'slate' | 'emerald' | 'rose' | 'blue' | 'indigo' | 'orange';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  size = 'sm',
}) => {
  const variantStyles = {
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
    blue: 'bg-blue-50 text-blue-800 border-blue-200/80',
    indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
    orange: 'bg-orange-50 text-orange-800 border-orange-200/80',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
};

export const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'Draft':
      return <Badge variant="slate">Draft</Badge>;
    case 'Confirmed':
      return <Badge variant="blue">Confirmed</Badge>;
    case 'Processing':
      return <Badge variant="indigo">Processing</Badge>;
    case 'Packed':
      return <Badge variant="amber">Packed</Badge>;
    case 'Shipped':
      return <Badge variant="orange">Shipped</Badge>;
    case 'Delivered':
      return <Badge variant="emerald">Delivered</Badge>;
    case 'Cancelled':
      return <Badge variant="rose">Cancelled</Badge>;
    case 'Returned':
      return <Badge variant="rose">Returned</Badge>;
    default:
      return <Badge variant="slate">{status}</Badge>;
  }
};

export const PaymentStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'Paid':
      return <Badge variant="emerald">Paid</Badge>;
    case 'Partial':
      return <Badge variant="amber">Partial</Badge>;
    case 'Pending':
      return <Badge variant="rose">Pending</Badge>;
    case 'Refunded':
      return <Badge variant="slate">Refunded</Badge>;
    default:
      return <Badge variant="slate">{status}</Badge>;
  }
};
