import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface HighlightTextProps extends TextProps {
  text: string;
  term: string;
  highlightStyle?: TextStyle;
}

export const HighlightText: React.FC<HighlightTextProps> = ({ 
  text, 
  term, 
  highlightStyle, 
  style, 
  ...props 
}) => {
  const { colors } = useTheme();
  
  if (!term || !term.trim()) {
    return <Text style={style} {...props}>{text}</Text>;
  }

  const terms = term.trim().split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) {
    return <Text style={style} {...props}>{text}</Text>;
  }
  
  // Create a regex that matches any of the terms, case insensitive
  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <Text style={style} {...props}>
      {parts.map((part, i) => {
        // Check if this part matches any of the terms
        const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
        
        return isMatch ? (
          <Text 
            key={i} 
            style={[
              { 
                backgroundColor: colors.primary + '30', // 30% opacity
                color: colors.primary,
                fontWeight: '700'
              }, 
              highlightStyle
            ]}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        );
      })}
    </Text>
  );
};

