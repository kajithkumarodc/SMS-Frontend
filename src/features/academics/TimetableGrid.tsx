import { forwardRef } from 'react';
import { Typography, theme } from 'antd';
import { BankOutlined, ClockCircleOutlined, CloseCircleFilled, ReadOutlined, UserOutlined } from '@ant-design/icons';
import { WEEK_DAYS, type Period } from '../../api/academics';
import { formatDisplayTime } from '../../lib/dates';

const { Text } = Typography;

type Props = {
  periods: Period[];
  /** Names a period's section ("Class 1 · A") -- shown on every card of a teacher's timetable. */
  sectionLabel?: (period: Period) => string | undefined;
};

/** The week as seven columns of period cards: subject, time, teacher and room. A day with none says "Not Scheduled". */
const TimetableGrid = forwardRef<HTMLDivElement, Props>(function TimetableGrid({ periods, sectionLabel }, ref) {
  const { token } = theme.useToken();
  const line: React.CSSProperties = { display: 'flex', gap: token.marginXS, color: token.colorSuccess, lineHeight: 1.4, marginBottom: token.marginXXS };

  return (
    <div ref={ref} data-testid="timetable-grid" style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: token.marginSM, minWidth: 1100 }}>
        {WEEK_DAYS.map((day, index) => {
          const dayPeriods = periods.filter((p) => p.dayOfWeek === index + 1);
          return (
            <div key={day}>
              <div style={{ fontWeight: 600, padding: `${token.paddingXS}px 0`, borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: token.marginSM }}>
                {day}
              </div>
              {dayPeriods.length === 0 ? (
                <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius, padding: token.paddingSM, color: token.colorError }}>
                  <CloseCircleFilled /> Not Scheduled
                </div>
              ) : (
                dayPeriods.map((p) => (
                  <div
                    key={p.id}
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius, padding: token.paddingSM, marginBottom: token.marginSM }}
                  >
                    {sectionLabel?.(p) && (
                      <Text strong style={{ display: 'block', marginBottom: token.marginXXS }}>
                        {sectionLabel(p)}
                      </Text>
                    )}
                    <div style={line}>
                      <ReadOutlined style={{ marginTop: 4 }} />
                      <span>
                        Subject: {p.subjectName}
                        {p.subjectCode ? ` (${p.subjectCode})` : ''}
                      </span>
                    </div>
                    <div style={line}>
                      <ClockCircleOutlined style={{ marginTop: 4 }} />
                      <span>
                        {formatDisplayTime(p.timeFrom)} - {formatDisplayTime(p.timeTo)}
                      </span>
                    </div>
                    {p.staffName && (
                      <div style={line}>
                        <UserOutlined style={{ marginTop: 4 }} />
                        <span>
                          {p.staffName}
                          {p.staffCode ? ` (${p.staffCode})` : ''}
                        </span>
                      </div>
                    )}
                    {p.roomNo && (
                      <div style={line}>
                        <BankOutlined style={{ marginTop: 4 }} />
                        <span>Room No.: {p.roomNo}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default TimetableGrid;
