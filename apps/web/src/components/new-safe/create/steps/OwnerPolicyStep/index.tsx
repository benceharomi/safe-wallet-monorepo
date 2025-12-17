import useAddressBook from '@/hooks/useAddressBook'
import useWallet from '@/hooks/wallets/useWallet'
import { Button, SvgIcon, MenuItem, Tooltip, Typography, Divider, Box, Grid, TextField } from '@mui/material'
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form'
import type { ReactElement } from 'react'
import { useState, useEffect } from 'react'

import AddIcon from '@/public/images/common/add.svg'
import InfoIcon from '@/public/images/notifications/info.svg'
import type { NamedAddress, EmailOwner } from '@/components/new-safe/create/types'
import type { StepRenderProps } from '@/components/new-safe/CardStepper/useCardStepper'
import type { NewSafeFormData } from '@/components/new-safe/create'
import type { CreateSafeInfoItem } from '@/components/new-safe/create/CreateSafeInfos'
import { useSafeSetupHints } from '@/components/new-safe/create/steps/OwnerPolicyStep/useSafeSetupHints'
import useSyncSafeCreationStep from '@/components/new-safe/create/useSyncSafeCreationStep'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import layoutCss from '@/components/new-safe/create/styles.module.css'
import { CREATE_SAFE_EVENTS, trackEvent } from '@/services/analytics'
import OwnerRow from '@/components/new-safe/OwnerRow'
import { maybePlural } from '@safe-global/utils/utils/formatters'
import EmailRow from '../../../EmailRow'

enum OwnerPolicyStepFields {
  emailOwners = 'emailOwners',
  owners = 'owners',
  threshold = 'threshold',
}

export type OwnerPolicyStepForm = {
  [OwnerPolicyStepFields.emailOwners]: EmailOwner[]
  [OwnerPolicyStepFields.owners]: NamedAddress[]
  [OwnerPolicyStepFields.threshold]: number
}

const OWNER_POLICY_STEP_FORM_ID = 'create-safe-owner-policy-step-form'

const OwnerPolicyStep = ({
  onSubmit,
  onBack,
  data,
  setStep,
  setDynamicHint,
}: StepRenderProps<NewSafeFormData> & {
  setDynamicHint: (hints: CreateSafeInfoItem | undefined) => void
}): ReactElement => {
  const wallet = useWallet()
  const addressBook = useAddressBook()
  const defaultOwnerAddressBookName = wallet?.address ? addressBook[wallet.address] : undefined
  const defaultOwner: NamedAddress = {
    name: defaultOwnerAddressBookName || wallet?.ens || '',
    address: wallet?.address || '',
  }
  useSyncSafeCreationStep(setStep, data.networks)

  const formMethods = useForm<OwnerPolicyStepForm>({
    mode: 'onChange',
    defaultValues: {
      [OwnerPolicyStepFields.owners]: data.owners.length > 0 ? data.owners : [defaultOwner],
      [OwnerPolicyStepFields.emailOwners]: data.emailOwners || [],
      [OwnerPolicyStepFields.threshold]: data.threshold,
    },
  })

  const { handleSubmit, control, watch, formState, getValues, setValue, trigger } = formMethods

  const threshold = watch(OwnerPolicyStepFields.threshold)

  const {
    fields: ownerFields,
    append: appendOwner,
    remove: removeOwnerField,
  } = useFieldArray({ control, name: OwnerPolicyStepFields.owners })

  const {
    fields: emailOwnerFields,
    append: appendEmailOwner,
    remove: removeEmailOwnerField,
  } = useFieldArray({ control, name: OwnerPolicyStepFields.emailOwners })

  // Maintain a list of all owners for threshold dropdown
  const [allOwnerFields, setAllOwnerFields] = useState<{ address: string }[]>([])

  // Update allOwnerFields whenever owners or emailOwners change
  useEffect(() => {
    const ownerValues = getValues(OwnerPolicyStepFields.owners) || []
    const emailOwnerValues = getValues(OwnerPolicyStepFields.emailOwners) || []

    // Only count email owners that have an address assigned (meaning they've been deployed)
    const deployedEmailOwners = emailOwnerValues.filter((owner) => !!owner?.address)

    const totalOwners = [...ownerValues, ...deployedEmailOwners]
    setAllOwnerFields(totalOwners)

    // If threshold is greater than the number of owners, adjust it
    if (threshold > totalOwners.length) {
      setValue(OwnerPolicyStepFields.threshold, totalOwners.length > 0 ? totalOwners.length : 1)
    } else if (totalOwners.length > 0 && (!threshold || threshold < 1)) {
      // Ensure threshold is at least 1 if we have owners
      setValue(OwnerPolicyStepFields.threshold, 1)
    }
  }, [ownerFields, emailOwnerFields, setValue, getValues, threshold])

  const removeOwner = (index: number): void => {
    // Set threshold if it's greater than the number of owners
    setValue(OwnerPolicyStepFields.threshold, Math.min(threshold, allOwnerFields.length - 1))
    removeOwnerField(index)
    trigger(OwnerPolicyStepFields.owners)
  }

  const removeEmailOwner = (index: number): void => {
    // Set threshold if it's greater than the number of owners
    setValue(OwnerPolicyStepFields.threshold, Math.min(threshold, allOwnerFields.length - 1))
    removeEmailOwnerField(index)
    trigger(OwnerPolicyStepFields.emailOwners)
  }

  const emailOwnerValues = watch(OwnerPolicyStepFields.emailOwners)
  const isDisabled = !formState.isValid || emailOwnerValues.some((owner) => !owner?.address)

  useSafeSetupHints(setDynamicHint, threshold, ownerFields.length)

  const handleBack = () => {
    const formData = getValues()
    onBack({ ...data, ...formData })
  }

  const onFormSubmit = handleSubmit((data) => {
    onSubmit(data)

    trackEvent({
      ...CREATE_SAFE_EVENTS.OWNERS,
      label: data.owners.length,
    })

    trackEvent({
      ...CREATE_SAFE_EVENTS.THRESHOLD,
      label: data.threshold,
    })
  })

  // Force a refresh of the owner fields and threshold options
  const refreshOwnerFields = () => {
    // Force re-render and recalculation of all fields
    const ownerValues = getValues(OwnerPolicyStepFields.owners) || []
    const emailOwnerValues = getValues(OwnerPolicyStepFields.emailOwners) || []
    const deployedEmailOwners = emailOwnerValues.filter((owner) => !!owner?.address)

    const totalOwners = [...ownerValues, ...deployedEmailOwners]
    setAllOwnerFields(totalOwners)

    // Increase threshold by 1 if an email signer was just deployed
    if (deployedEmailOwners.length > 0) {
      const currentThreshold = getValues(OwnerPolicyStepFields.threshold)
      const newThreshold = Math.min(currentThreshold + 1, totalOwners.length)
      setValue(OwnerPolicyStepFields.threshold, newThreshold)
    }

    // Trigger validation to update the form state
    trigger()
  }

  return (
    <form data-testid="owner-policy-step-form" onSubmit={onFormSubmit} id={OWNER_POLICY_STEP_FORM_ID}>
      <FormProvider {...formMethods}>
        <Box className={layoutCss.row}>
          {ownerFields.map((field, i) => (
            <OwnerRow
              key={field.id}
              index={i}
              removable={i > 0}
              groupName={OwnerPolicyStepFields.owners}
              remove={removeOwner}
            />
          ))}
          {emailOwnerFields.map((field, i) => (
            <EmailRow
              key={field.id}
              index={i}
              removable={true}
              groupName={OwnerPolicyStepFields.emailOwners}
              remove={removeEmailOwner}
              onDeployed={refreshOwnerFields} // Add the callback
            />
          ))}
          <Button
            data-testid="add-new-signer"
            variant="text"
            onClick={() => appendOwner({ name: '', address: '' }, { shouldFocus: true })}
            startIcon={<SvgIcon component={AddIcon} inheritViewBox fontSize="small" />}
            size="large"
          >
            Add new signer
          </Button>
          <Button
            data-testid="add-owner-btn"
            variant="text"
            onClick={() => appendEmailOwner({ email: '', address: '', accountCode: '' }, { shouldFocus: true })}
            startIcon={<SvgIcon component={AddIcon} inheritViewBox fontSize="small" />}
            size="large"
          >
            Add new email signer
          </Button>
        </Box>

        <Divider />
        <Box className={layoutCss.row}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            Threshold
            <Tooltip
              title="The threshold of a Safe Account specifies how many signers need to confirm a Safe Account transaction before it can be executed."
              arrow
              placement="top"
            >
              <span style={{ display: 'flex' }}>
                <SvgIcon component={InfoIcon} inheritViewBox color="border" fontSize="small" />
              </span>
            </Tooltip>
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mb: 2,
            }}
          >
            Any transaction requires the confirmation of:
          </Typography>
          <Grid
            container
            direction="row"
            sx={{
              alignItems: 'center',
              gap: 2,
              pt: 1,
            }}
          >
            <Grid item>
              <Controller
                control={control}
                name="threshold"
                render={({ field }) => (
                  <TextField data-testid="threshold-selector" select {...field} disabled={allOwnerFields.length === 0}>
                    {Array.from({ length: Math.max(1, allOwnerFields.length) }, (_, idx) => (
                      <MenuItem data-testid="threshold-item" key={idx + 1} value={idx + 1}>
                        {idx + 1}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item>
              <Typography>
                out of {allOwnerFields.length || 0} signer{maybePlural(allOwnerFields.length || 0)}
              </Typography>
            </Grid>
          </Grid>
        </Box>
        <Divider />
        <Box className={layoutCss.row}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 3,
            }}
          >
            <Button
              data-testid="back-btn"
              variant="outlined"
              size="small"
              onClick={handleBack}
              startIcon={<ArrowBackIcon fontSize="small" />}
            >
              Back
            </Button>
            <Button data-testid="next-btn" type="submit" variant="contained" size="stretched" disabled={isDisabled}>
              Next
            </Button>
          </Box>
        </Box>
      </FormProvider>
    </form>
  )
}

export default OwnerPolicyStep
