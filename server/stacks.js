import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { TransactionVersion } from '@stacks/network';

async function checkAllAccounts() {
  const seedPhrase = 'police trip peace glad medal genre visa divert vapor predict rebuild cargo';
  const password = 'ahobhit8831';

  const wallet = await generateWallet({
    secretKey: seedPhrase,
    password: password,
  });

  console.log(`Total accounts: ${wallet.accounts.length}`);
  
  // Check only available accounts
  for (let i = 0; i < wallet.accounts.length; i++) {
    try {
      const testnetAddress = getStxAddress({
        account: wallet.accounts[i],
        transactionVersion: TransactionVersion.Testnet
      });
      
      const mainnetAddress = getStxAddress({
        account: wallet.accounts[i],
        transactionVersion: TransactionVersion.Mainnet
      });
      
      console.log(`\nAccount ${i}:`);
      console.log(`  Testnet: ${testnetAddress}`);
      console.log(`  Mainnet: ${mainnetAddress}`);
      console.log(`  Are they different? ${testnetAddress !== mainnetAddress}`);
      
      // Get private key for this account
      const privateKey = wallet.accounts[i].stxPrivateKey;
      console.log(`  Private Key: ${privateKey}`);
      
    } catch (error) {
      console.log(`Error with account ${i}:`, error.message);
    }
  }
  
  // Trust only direct derivation (@stacks/transactions). Wallet-SDK getStxAddress returns
  // the same SP address for both networks; testnet must be ST prefix.
  console.log('\n--- Direct derivation from private key (use these addresses) ---');
  const firstPrivateKey = wallet.accounts[0].stxPrivateKey;
  const { getAddressFromPrivateKey } = await import('@stacks/transactions');

  const mainnetAddr = getAddressFromPrivateKey(firstPrivateKey, 'mainnet');
  const testnetAddr = getAddressFromPrivateKey(firstPrivateKey, 'testnet');

  console.log(`  Mainnet: ${mainnetAddr}`);
  console.log(`  Testnet: ${testnetAddr}`);

  console.log('\n--- Final: use for STACKS_SENDER_SECRET_KEY (.env) ---');
  console.log(firstPrivateKey);
}

checkAllAccounts().catch(console.error);