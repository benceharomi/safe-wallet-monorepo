import { useMemo, useState, useCallback } from 'react'
import { Button, FormControl, Grid, IconButton, SvgIcon, Typography } from '@mui/material'
import DeleteIcon from '@/public/images/common/delete.svg'
import { useFormContext, useWatch } from 'react-hook-form'
import classNames from 'classnames'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CircularProgress from '@mui/material/CircularProgress'
import EthHashInfo from '@/components/common/EthHashInfo'
import type { EmailOwner } from '../create/types'
import EmailInput from '../../common/EmailInput'
import useWallet from '@/hooks/wallets/useWallet'
import { Alert, Snackbar } from '@mui/material'
import { useCurrentChain } from '../../../hooks/useChains'
import { ethers } from 'ethers'
import { createWeb3 } from '../../../hooks/wallets/web3'
import { buildPoseidon } from 'circomlibjs'

// Constants for email signer deployment
const EMAIL_SIGNER_FACTORY_ADDRESS = '0x86227311CeDA2dbF64123854bcc359D6C4cDB8a3'
const RELAYER_URL = 'https://safe-2fa-relayer.zk.email' // Replace with actual URL

// Email signer factory ABI
const EMAIL_SIGNER_FACTORY_ABI = [
  'function predictAddress(bytes32 accountSalt) view returns (address)',
  'function deploy(bytes32 accountSalt) returns (address)',
]

// Generate a new account code
const generateNewAccountCode = async (): Promise<string> => {
  const poseidon = await buildPoseidon()
  const accountCodeBytes: Uint8Array = poseidon.F.random()

  const newCode = ethers.hexlify(accountCodeBytes.reverse())
  console.log(`Generated new account code: ${newCode}`)
  return newCode
}

export const EmailRow = ({
  index,
  groupName,
  removable = true,
  remove,
  readOnly = false,
  onDeployed,
}: {
  index: number
  removable?: boolean
  groupName: string
  remove?: (index: number) => void
  readOnly?: boolean
  onDeployed?: () => void
}) => {
  const wallet = useWallet()
  const chain = useCurrentChain()

  const [isDeploying, setIsDeploying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fieldName = `${groupName}.${index}`
  const { control, setValue, getValues, trigger } = useFormContext()
  const emailOwners = useWatch({
    control,
    name: groupName,
  })

  const deps = useMemo(() => {
    return Array.from({ length: emailOwners.length }, (_, i) => `${groupName}.${i}`)
  }, [emailOwners.length, groupName])

  const validateEmailAddress = useCallback(
    async (email: string) => {
      const owners = getValues('owners')
      if (owners.filter((emailOwner: EmailOwner) => emailOwner.email === email).length > 1) {
        return 'Email is already added'
      }
    },
    [getValues],
  )

  // Watch for this specific field's value
  const fieldValue = useWatch({
    control,
    name: fieldName,
  })

  const hasAddress = useMemo(() => {
    return !!fieldValue?.address
  }, [fieldValue])

  const handleOnClick = async () => {
    setIsDeploying(true)
    setError(null)

    try {
      // Get the email value
      const email = getValues(`${fieldName}.email`)

      if (!email) {
        throw new Error('Email address is required')
      }

      if (!wallet || !wallet.provider || !chain || !wallet.address) {
        throw new Error('Wallet not properly connected')
      }

      console.log('Fetching account salt from relayer...')

      const accountCode = await generateNewAccountCode()

      setValue(`${fieldName}.accountCode`, accountCode, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      })

      // Get the salt from the relayer
      const saltResponse = await fetch(`${RELAYER_URL}/api/accountSalt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountCode,
          emailAddress: email,
        }),
      })

      if (!saltResponse.ok) {
        throw new Error('Failed to get account salt from relayer')
      }

      const { accountSalt } = await saltResponse.json()
      console.log(`Account salt: ${accountSalt}`)

      // Create a contract instance for the email signer factory
      const provider = createWeb3(wallet.provider)
      const signer = await provider.getSigner()
      const emailSignerFactory = new ethers.Contract(EMAIL_SIGNER_FACTORY_ADDRESS, EMAIL_SIGNER_FACTORY_ABI, signer)

      // Predict the email signer address
      console.log('Predicting email signer address...')
      const signerAddress = await emailSignerFactory.predictAddress(accountSalt)
      console.log(`Email signer address: ${signerAddress}`)

      // Check if the email signer is already deployed
      const bytecode = await provider.getCode(signerAddress)
      const isEmailSignerDeployed = bytecode !== '0x' && bytecode !== '0x0'
      console.log(`Email signer contract deployed: ${isEmailSignerDeployed}`)

      // Deploy if not already deployed
      if (!isEmailSignerDeployed) {
        console.log('Deploying email signer contract...')
        const tx = await emailSignerFactory.deploy(accountSalt)
        console.log(`Deployment transaction hash: ${tx.hash}`)

        // Wait for the transaction to be mined
        const receipt = await tx.wait()
        console.log('Email signer contract deployed successfully at:', receipt.contractAddress)
      }

      // Update the address field directly
      setValue(`${fieldName}.address`, signerAddress, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      })

      // Force trigger validation for the entire form
      trigger(groupName)

      // Call the callback to notify parent component
      if (onDeployed) {
        onDeployed()
      }
    } catch (err) {
      console.error('Error deploying email signer:', err)
      setError(err instanceof Error ? err.message : 'Failed to deploy email signer')
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <>
      <Grid
        container
        spacing={3}
        className={classNames({})}
        sx={{
          alignItems: 'center',
          marginBottom: 3,
          flexWrap: ['wrap', undefined, 'nowrap'],
        }}
      >
        <Grid item xs={11} md={7}>
          <FormControl fullWidth>
            <EmailInput email={`${fieldName}.email`} label="Email" validate={validateEmailAddress} deps={deps} />
          </FormControl>
        </Grid>
        <Grid item xs={11} md={5}>
          {hasAddress ? (
            <Typography variant="body2" component="div">
              <EthHashInfo address={fieldValue?.address} shortAddress hasExplorer showCopyButton />
            </Typography>
          ) : (
            <Button
              data-testid="deploy-btn"
              variant="contained"
              size="small"
              onClick={handleOnClick}
              disabled={isDeploying}
              startIcon={isDeploying ? <CircularProgress size={20} /> : <ArrowUpwardIcon fontSize="small" />}
            >
              {isDeploying ? 'Deploying' : 'Deploy'}
            </Button>
          )}
        </Grid>
        {!readOnly && (
          <Grid
            item
            xs={1}
            sx={{
              ml: -2,
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {removable && (
              <>
                <IconButton
                  data-testid="remove-owner-btn"
                  onClick={() => remove?.(index)}
                  aria-label="Remove email signer"
                >
                  <SvgIcon component={DeleteIcon} inheritViewBox />
                </IconButton>
              </>
            )}
          </Grid>
        )}
      </Grid>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  )
}

export default EmailRow
