// Reusable Icon component wrapper for lucide-react icons
import React from 'react';
import * as LucideIcons from 'lucide-react';

const Icon = ({ name, size = 20, color, className, ...props }) => {
  const IconComponent = LucideIcons[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }
  
  return (
    <IconComponent 
      size={size} 
      color={color} 
      className={className}
      {...props}
    />
  );
};

export default Icon;

