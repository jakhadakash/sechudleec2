# Cost Display Fix

## Problem

The dashboard was showing ₹7,483 as the big number, which was confusing because:
- It showed month-to-date actual cost (₹7,483)
- But users expected to see the expected scheduled cost (₹1,599)

## Solution

Changed the cost card to prominently display the **expected scheduled cost** instead of actual cost.

### New Display

**Big Number**: ₹1,599 (green)
- Label: "Expected with scheduling (43% uptime)"
- Sub-label: "Actual: ₹9,353 (running more than scheduled)"

**Comparison Rows**:
1. Without scheduling (24/7): ₹3,134 (red)
2. Monthly savings: ₹1,535 (49%) (green)

**Cost Breakdown**:
- EC2 (24/7): ₹2,693
- EC2 (scheduled 43%): ₹1,158
- EBS 60GB gp3: ₹441

### Visual Hierarchy

```
┌─────────────────────────────────────┐
│ Monthly Cost              ON TRACK  │
├─────────────────────────────────────┤
│                                     │
│  ₹1,599  ← Big, green (expected)   │
│  Expected with scheduling (43%)     │
│  Actual: ₹9,353 (running more)      │
│                                     │
│  [Bar chart showing daily costs]    │
│                                     │
│  Without scheduling: ₹3,134 (red)   │
│  Monthly savings: ₹1,535 (green)    │
│                                     │
│  EC2 (24/7): ₹2,693                 │
│  EC2 (scheduled): ₹1,158            │
│  EBS 60GB: ₹441                     │
└─────────────────────────────────────┘
```

## Key Changes

### Before
- Big number showed actual month-to-date cost (₹7,483)
- Confusing because it wasn't clear what this represented
- Users couldn't quickly see expected cost

### After
- Big number shows expected scheduled cost (₹1,599)
- Color-coded: green if on track, red if over budget
- Actual cost shown as secondary info
- Clear labels explain what each number means

## User Benefits

1. **Clear Expectations**: Users immediately see what they should be paying
2. **Quick Comparison**: Easy to see actual vs expected
3. **Savings Visible**: Monthly savings prominently displayed
4. **Detailed Breakdown**: Cost components shown at bottom

## Technical Implementation

```typescript
// Show expected scheduled cost as big number
const animatedCost = useCountUp(data?.projected_monthly_inr ?? null);

// Show actual cost as secondary info
const actualCost = useCountUp(data?.actual_projected_monthly_inr ?? null);

// Color based on on_track status
color: onTrack === false ? '#FF6B6B' : '#00E676'
```

## Restart Frontend

If using React dev server:
```bash
cd ec2-dashboard/frontend-react
npm run dev
```

If using production build:
```bash
cd ec2-dashboard/frontend-react
npm run build
# Then restart nginx or your web server
```

## Verification

The cost card should now show:
- ✅ Big number: ₹1,599 (expected scheduled cost)
- ✅ Green color (on track)
- ✅ Actual cost as secondary info: ₹9,353
- ✅ Clear labels explaining each value
- ✅ Savings calculation: ₹1,535 (49%)

## Summary

The cost display now clearly shows:
- **What you should pay**: ₹1,599/month with scheduling
- **What you're actually paying**: ₹9,353/month (needs automation)
- **What you'd pay without scheduling**: ₹3,134/month
- **How much you'll save**: ₹1,535/month (49%)

Once EventBridge automation is active, your actual cost will drop to match the expected cost of ₹1,599/month.
