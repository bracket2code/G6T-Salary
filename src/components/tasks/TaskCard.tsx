import React from 'react';
import { Calendar } from 'lucide-react';
import { Task } from '../../types';
import { formatDate } from '../../lib/utils';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white dark:bg-dark-800 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors duration-200"
    >
      <div className="mb-2">
        <span className={`
          px-2 py-1 text-xs font-medium rounded-full
          ${task.priority === 'critica' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
            task.priority === 'alta' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
            task.priority === 'media' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}
        `}>
           {task.priority === 'critica' ? 'Crítica' :
            task.priority === 'alta' ? 'Alta' :
            task.priority === 'media' ? 'Media' : 'Baja'}
         </span>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {task.title}
      </h3>

      {task.description && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
          {task.description}
        </p>
      )}

      <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
        <Calendar size={16} className="mr-2" />
        <span>{formatDate(task.startDate)}</span>
      </div>
    </div>
  );
};