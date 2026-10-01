/**
 * Grid / list view switch. Placed next to the search field on list pages.
 */
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { GridViewRounded, ViewListRounded } from '@mui/icons-material';

export const VIEW_GRID = 'grid';
export const VIEW_LIST = 'list';

export default function ViewToggle({ value, onChange, label = 'Change view' }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next) => next && onChange(next)}
      aria-label={label}
      sx={{
        '& .MuiToggleButton-root': {
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px !important',
          px: 1.25,
          color: 'text.secondary',
          '&.Mui-selected': { color: 'primary.main', bgcolor: 'action.selected' },
        },
      }}
    >
      <Tooltip title="Grid view">
        <ToggleButton value={VIEW_GRID} aria-label="Grid view">
          <GridViewRounded fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="List view">
        <ToggleButton value={VIEW_LIST} aria-label="List view">
          <ViewListRounded fontSize="small" />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
}
