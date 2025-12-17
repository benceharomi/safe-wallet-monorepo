import type { RelaysRemaining } from '@safe-global/store/gateway/AUTO_GENERATED/relay'

import { Box, FormControl, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import type { Dispatch, SetStateAction, ReactElement, ChangeEvent } from 'react'
import useWallet from '@/hooks/wallets/useWallet'
import WalletIcon from '@/components/common/WalletIcon'
import RemainingRelays from '../RemainingRelays'
import GasTooHighBanner from '@/features/no-fee-november/components/GasTooHighBanner'

import css from './styles.module.css'
import BalanceInfo from '@/components/tx/BalanceInfo'
import madProps from '@/utils/mad-props'
import type { ConnectedWallet } from '@/hooks/wallets/useOnboard'

export const enum ExecutionMethod {
  RELAY = 'RELAY',
  WALLET = 'WALLET',
  NO_FEE_NOVEMBER = 'NO_FEE_NOVEMBER',
}

const _ExecutionMethodSelector = ({
  wallet,
  executionMethod,
  setExecutionMethod,
  relays,
  noLabel,
  tooltip,
  noFeeNovember,
  gasTooHigh,
}: {
  wallet: ConnectedWallet | null
  executionMethod: ExecutionMethod
  setExecutionMethod: Dispatch<SetStateAction<ExecutionMethod>>
  relays?: RelaysRemaining
  noLabel?: boolean
  tooltip?: string
  noFeeNovember?: {
    isEligible: boolean
    remaining: number
    limit: number
  }
  gasTooHigh?: boolean
}): ReactElement | null => {
  const shouldRelay = executionMethod === ExecutionMethod.RELAY || executionMethod === ExecutionMethod.NO_FEE_NOVEMBER

  const onChooseExecutionMethod = (_: ChangeEvent<HTMLInputElement>, newExecutionMethod: string) => {
    setExecutionMethod(newExecutionMethod as ExecutionMethod)
  }

  return (
    <Box className={css.container} sx={{ borderRadius: ({ shape }) => `${shape.borderRadius}px` }}>
      <div className={css.method}>
        <FormControl sx={{ display: 'flex' }}>
          {!noLabel ? (
            <Typography variant="body2" className={css.label}>
              Who will pay gas fees:
            </Typography>
          ) : null}

          <RadioGroup row value={ExecutionMethod.WALLET} onChange={onChooseExecutionMethod} className={css.radioGroup}>
            <FormControlLabel
              data-testid="connected-wallet-execution-method"
              sx={{ flex: 1 }}
              value={ExecutionMethod.WALLET}
              label={
                <Typography className={css.radioLabel}>
                  <WalletIcon provider={wallet?.label || ''} width={20} height={20} icon={wallet?.icon} /> Connected
                  wallet
                </Typography>
              }
              control={<Radio />}
            />
          </RadioGroup>
        </FormControl>

        {/* Gas too high banner - shown inside method section when gas is too high */}
        {gasTooHigh && noFeeNovember?.isEligible && (
          <div className={css.gasBannerWrapper}>
            <GasTooHighBanner />
          </div>
        )}
      </div>

      {shouldRelay && noFeeNovember?.isEligible ? (
        <Typography variant="body2" className={css.transactionCounter}>
          <span className={css.counterNumber}>{noFeeNovember.remaining}</span> free transactions left
        </Typography>
      ) : shouldRelay && relays ? (
        <RemainingRelays relays={relays} tooltip={tooltip} />
      ) : wallet ? (
        <BalanceInfo />
      ) : null}
    </Box>
  )
}

export const ExecutionMethodSelector = madProps(_ExecutionMethodSelector, {
  wallet: useWallet,
})
